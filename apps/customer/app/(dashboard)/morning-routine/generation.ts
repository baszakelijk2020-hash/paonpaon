import {
  AppointmentRepository,
  CustomerConsentRepository,
  MorningRoutineRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
  StyleProfileRepository,
  WardrobeLifecycleRepository,
  WardrobeRepository,
  type PaonSupabaseClient,
} from "@paon/database";
import {
  attachRetailerSlugToActions,
  buildConsentSnapshot,
  daysBetween,
  isPurposeGranted,
  persistMorningRoutineSelectionInputSchema,
  projectLifecycleState,
  resolveMorningRoutineInputStatuses,
  selectMorningRoutine,
  type CalendarOccasion,
  type CustomerId,
  type MorningRoutineCatalogueCandidate,
  type MorningRoutineStyleSignals,
  type MorningRoutineWardrobeCandidate,
  type RetailerId,
  type WeatherSnapshot,
} from "@paon/domain";

import { AppointmentCalendarProvider } from "@/lib/calendar-from-appointments";
import { OpenWeatherProvider } from "@/lib/weather";

/**
 * The generation body `generateMorningRoutineSelection` (actions.ts) already
 * had, extracted so the dashboard can auto-generate today's selection on
 * page load instead of requiring the manual "Select today" button that
 * action is bound to. Same inputs, same persisted shape — this is not a
 * second recommendation engine.
 */
export async function buildAndPersistMorningRoutineSelection(params: {
  supabase: PaonSupabaseClient;
  retailerId: RetailerId;
  customerId: CustomerId;
  forDate: string;
  occasionLabel?: string;
}): Promise<string> {
  const { supabase, retailerId, customerId, forDate } = params;

  const consentState = await new CustomerConsentRepository(supabase).getState(
    retailerId,
    customerId,
  );
  const consent = buildConsentSnapshot({
    state: consentState,
    basis: "explicit_opt_in",
    capturedAt: new Date().toISOString(),
  });

  const retailer = await new RetailerRepository(supabase).findById(retailerId);
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
      retailerId,
      customerId,
    });
    occasions = [...day.occasions];
  } catch {
    calendarFailed = true;
  }
  if (params.occasionLabel) {
    occasions = [
      {
        label: params.occasionLabel,
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

  return new MorningRoutineRepository(supabase).persistSelection(
    persistPayload,
  );
}

/**
 * Auto-generation for the dashboard hero: only builds a fresh selection when
 * today's does not already exist, so loading the dashboard repeatedly in one
 * day does not silently reshuffle "today's look" underneath the customer.
 */
export async function ensureTodaysMorningRoutineSelection(params: {
  supabase: PaonSupabaseClient;
  retailerId: RetailerId;
  customerId: CustomerId;
  forDate: string;
}) {
  const routineRepo = new MorningRoutineRepository(params.supabase);
  const existing = await routineRepo.findLatestForCustomerDay(
    params.customerId,
    params.forDate,
  );
  if (existing) return existing;

  try {
    await buildAndPersistMorningRoutineSelection(params);
  } catch {
    // Module off, no consent, no catalogue, etc. — the dashboard hero
    // falls back to its generic banner; this is not a page-load error.
    return null;
  }
  return routineRepo.findLatestForCustomerDay(
    params.customerId,
    params.forDate,
  );
}
