"use server";

import {
  AppointmentRepository,
  CustomerConsentRepository,
  CustomerRepository,
  MorningRoutineRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
  StyleProfileRepository,
  WardrobeLifecycleRepository,
  WardrobeRepository,
  WishlistRepository,
} from "@paon/database";
import {
  asId,
  attachRetailerSlugToActions,
  buildConsentSnapshot,
  daysBetween,
  generateMorningRoutineInputSchema,
  isPurposeGranted,
  morningRoutineActionInputSchema,
  persistMorningRoutineSelectionInputSchema,
  projectLifecycleState,
  resolveMorningRoutineInputStatuses,
  selectMorningRoutine,
  type CalendarOccasion,
  type MorningRoutineCatalogueCandidate,
  type MorningRoutineStyleSignals,
  type MorningRoutineWardrobeCandidate,
  type WeatherSnapshot,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { AppointmentCalendarProvider } from "@/lib/calendar-from-appointments";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { OpenWeatherProvider } from "@/lib/weather";

export interface MorningRoutineActionState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
  selectionId?: string;
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function zodFieldErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function resolveCustomerForUser(
  userId: string,
  retailerId: string,
  customerId: string,
) {
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    userId as never,
  );
  const customer = customers.find(
    (candidate) =>
      candidate.id === customerId && candidate.retailerId === retailerId,
  );
  if (!customer) return null;
  return { customer, supabase };
}

export async function generateMorningRoutineSelection(
  _prevState: MorningRoutineActionState,
  formData: FormData,
): Promise<MorningRoutineActionState> {
  const session = await requireSession();
  const parsed = generateMorningRoutineInputSchema.safeParse({
    retailerId: formData.get("retailerId"),
    customerId: formData.get("customerId"),
    forDate: optionalString(formData.get("forDate")) ?? todayUtcDate(),
    occasionLabel: optionalString(formData.get("occasionLabel")),
  });
  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  const owned = await resolveCustomerForUser(
    session.userId,
    parsed.data.retailerId,
    parsed.data.customerId,
  );
  if (!owned) {
    return { fieldErrors: {}, formError: "Customer relationship not found." };
  }

  const { customer, supabase } = owned;
  const retailerId = asId<"RetailerId">(customer.retailerId);
  const customerId = asId<"CustomerId">(customer.id);
  const forDate = parsed.data.forDate ?? todayUtcDate();

  try {
    const consentState = await new CustomerConsentRepository(supabase).getState(
      retailerId,
      customerId,
    );
    const consent = buildConsentSnapshot({
      state: consentState,
      basis: "explicit_opt_in",
      capturedAt: new Date().toISOString(),
    });

    const retailer = await new RetailerRepository(supabase).findById(
      retailerId,
    );
    const storeCity = retailer?.billingAddress.city;
    const locationGranted = isPurposeGranted(consentState, "location");
    const locationLabel = locationGranted ? storeCity : undefined;

    let weather: WeatherSnapshot | null = null;
    let weatherFailed = false;
    if (locationGranted && locationLabel) {
      try {
        weather = await new OpenWeatherProvider().getCurrentWeather({
          locationLabel,
        });
      } catch {
        weatherFailed = true;
      }
    }

    const calendar = new AppointmentCalendarProvider(
      new AppointmentRepository(supabase),
    );
    let occasions: CalendarOccasion[] = [];
    let calendarFailed = false;
    try {
      const day = await calendar.listOccasionsForDay({
        day: forDate,
        retailerId: customer.retailerId,
        customerId: customer.id,
      });
      occasions = [...day.occasions];
    } catch {
      calendarFailed = true;
    }
    if (parsed.data.occasionLabel) {
      occasions = [
        {
          label: parsed.data.occasionLabel,
          startsAt: `${forDate}T09:00:00.000Z`,
          source: "declared",
        },
        ...occasions,
      ];
    }

    let styleSignals: MorningRoutineStyleSignals | null = null;
    if (isPurposeGranted(consentState, "personalization")) {
      const profile = await new StyleProfileRepository(supabase).findByCustomer(
        retailerId,
        customerId,
      );
      if (profile) {
        styleSignals = {
          declaredConceptIds: profile.explicitPreferences.map((p) =>
            String(p.conceptId),
          ),
          inferredPositiveConceptIds: profile.inferredPreferences
            .filter((p) => p.polarity === "positive")
            .map((p) => String(p.conceptId)),
          inferredNegativeConceptIds: profile.inferredPreferences
            .filter((p) => p.polarity === "negative")
            .map((p) => String(p.conceptId)),
        };
      }
    }

    const statuses = resolveMorningRoutineInputStatuses({
      consent,
      locationKind: storeCity ? "store_city" : "none",
      ...(locationLabel ? { locationLabel } : {}),
      weather,
      weatherFailed,
      occasions,
      calendarFailed,
      styleProfilePresent: styleSignals !== null,
    });

    const wardrobeRepo = new WardrobeRepository(supabase);
    const lifecycleRepo = new WardrobeLifecycleRepository(supabase);
    const items = await wardrobeRepo.findByCustomer(customerId);
    const nowIso = new Date().toISOString();
    const wardrobe: MorningRoutineWardrobeCandidate[] = await Promise.all(
      items.map(async (item) => {
        const events = await lifecycleRepo.listLifecycleEvents(item.id);
        const lifecycle = projectLifecycleState(events);
        const resting =
          lifecycle.lastWornAt !== undefined &&
          (lifecycle.lastRestedAt === undefined ||
            lifecycle.lastRestedAt < lifecycle.lastWornAt) &&
          daysBetween(lifecycle.lastWornAt, nowIso) < 3;
        return {
          wardrobeItemId: item.id,
          displayName: item.displayName,
          categoryCode: item.categoryCode,
          condition: item.condition,
          careState: item.careState,
          ...(item.retiredAt ? { retiredAt: item.retiredAt } : {}),
          ...(item.deletedAt ? { deletedAt: item.deletedAt } : {}),
          ...(item.productId ? { productId: item.productId } : {}),
          resting,
        };
      }),
    );

    const products = await new ProductRepository(supabase).findByRetailer(
      retailerId,
    );
    const variantRepo = new ProductVariantRepository(supabase);
    const catalogue: MorningRoutineCatalogueCandidate[] = [];
    for (const product of products
      .filter((p) => p.status === "active")
      .slice(0, 12)) {
      const variants = await variantRepo.findByProduct(product.id);
      const inStock =
        variants.find((v) => v.inventoryQuantity > 0) ?? variants[0];
      catalogue.push({
        productId: product.id,
        ...(inStock ? { productVariantId: inStock.id } : {}),
        displayName: product.name,
        productSlug: product.slug,
        available: Boolean(inStock),
        ...(product.primaryImageUrl
          ? { primaryImageUrl: product.primaryImageUrl }
          : {}),
      });
    }

    const selected = attachRetailerSlugToActions(
      selectMorningRoutine({
        retailerId,
        customerId,
        forDate,
        consent,
        wardrobe,
        catalogue,
        ...(styleSignals ? { styleProfile: styleSignals } : {}),
        ...(weather ? { weather } : {}),
        weatherStatus: statuses.weatherStatus,
        occasions,
        calendarStatus: statuses.calendarStatus,
        location: statuses.location,
        locationStatus: statuses.locationStatus,
        personalizationStatus: statuses.personalizationStatus,
      }),
      retailer?.slug ?? "store",
    );

    const persistPayload = persistMorningRoutineSelectionInputSchema.parse({
      retailerId: selected.retailerId,
      customerId: selected.customerId,
      forDate: selected.forDate,
      summary: selected.summary,
      provenance: selected.provenance,
      recommendations: selected.recommendations,
    });

    const selectionId = await new MorningRoutineRepository(
      supabase,
    ).persistSelection(persistPayload);

    revalidatePath("/morning-routine");
    revalidatePath("/dashboard");
    return {
      fieldErrors: {},
      success: true,
      selectionId,
    };
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "Could not build today’s routine.",
    };
  }
}

export async function runMorningRoutineAction(
  _prevState: MorningRoutineActionState,
  formData: FormData,
): Promise<MorningRoutineActionState> {
  const session = await requireSession();
  const parsed = morningRoutineActionInputSchema.safeParse({
    selectionId: formData.get("selectionId"),
    recommendationId: optionalString(formData.get("recommendationId")),
    action: formData.get("action"),
    productVariantId: optionalString(formData.get("productVariantId")),
    retailerId: formData.get("retailerId"),
    reviewNote: optionalString(formData.get("reviewNote")),
  });
  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await getSupabaseServerClient();
  const routineRepo = new MorningRoutineRepository(supabase);
  const view = await routineRepo.findById(parsed.data.selectionId);
  if (!view) {
    return { fieldErrors: {}, formError: "Routine selection not found." };
  }

  const owned = await resolveCustomerForUser(
    session.userId,
    view.selection.retailerId,
    view.selection.customerId,
  );
  if (!owned || owned.customer.retailerId !== parsed.data.retailerId) {
    return { fieldErrors: {}, formError: "Not authorized for this routine." };
  }

  try {
    if (parsed.data.action === "save") {
      if (parsed.data.productVariantId) {
        await new WishlistRepository(supabase).toggleItem(
          asId<"RetailerId">(parsed.data.retailerId),
          asId<"ProductVariantId">(parsed.data.productVariantId),
        );
      }
      await routineRepo.markReview(parsed.data.selectionId, "saved");
      revalidatePath("/wishlist");
    } else if (parsed.data.action === "review") {
      await routineRepo.markReview(parsed.data.selectionId, "reviewed");
    } else if (parsed.data.action === "book" || parsed.data.action === "buy") {
      // Navigation-only actions — authorization already verified.
    }

    revalidatePath("/morning-routine");
    return { fieldErrors: {}, success: true };
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not complete action.",
    };
  }
}
