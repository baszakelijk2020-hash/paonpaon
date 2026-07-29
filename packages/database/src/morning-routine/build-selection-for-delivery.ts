/**
 * Composes MorningRoutine selections for scheduled delivery (service_role).
 */

import {
  asId,
  attachRetailerSlugToActions,
  buildConsentSnapshot,
  daysBetween,
  filterCatalogueByEligibleProducts,
  isPurposeGranted,
  persistMorningRoutineSelectionInputSchema,
  projectLifecycleState,
  resolveMorningRoutineInputStatuses,
  selectMorningRoutine,
  type CalendarOccasion,
  type CalendarProvider,
  type MorningRoutineCatalogueCandidate,
  type MorningRoutineRetailerDeliverySettings,
  type MorningRoutineStyleSignals,
  type MorningRoutineWardrobeCandidate,
  type RetailerId,
  type WeatherProvider,
  type WeatherSnapshot,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import { CustomerConsentRepository } from "../repositories/customer-consent-repository";
import { MorningRoutineRepository } from "../repositories/morning-routine-repository";
import { ProductRepository } from "../repositories/product-repository";
import { ProductVariantRepository } from "../repositories/product-variant-repository";
import { RetailerRepository } from "../repositories/retailer-repository";
import { StyleProfileRepository } from "../repositories/style-profile-repository";
import { WardrobeLifecycleRepository } from "../repositories/wardrobe-lifecycle-repository";
import { WardrobeRepository } from "../repositories/wardrobe-repository";

export interface MorningRoutineRetailerSettingsReader {
  getRetailerSettings(
    retailerId: RetailerId | string,
  ): Promise<MorningRoutineRetailerDeliverySettings>;
}

export interface BuildMorningRoutineSelectionArgs {
  readonly client: PaonSupabaseClient;
  readonly deliveryRepo: MorningRoutineRetailerSettingsReader;
  readonly retailerId: string;
  readonly customerId: string;
  readonly forDate: string;
  readonly weatherProvider: WeatherProvider;
  readonly calendarProvider: CalendarProvider;
}

export async function buildMorningRoutineSelectionForDelivery(
  args: BuildMorningRoutineSelectionArgs,
): Promise<{ selectionId: string } | null> {
  const retailerId = asId<"RetailerId">(args.retailerId);
  const customerId = asId<"CustomerId">(args.customerId);

  const existing = await new MorningRoutineRepository(
    args.client,
  ).findLatestForCustomerDay(customerId, args.forDate);
  if (existing) {
    return { selectionId: existing.selection.id };
  }

  const consentState = await new CustomerConsentRepository(
    args.client,
  ).getState(retailerId, customerId);
  if (!isPurposeGranted(consentState, "personalization")) {
    return null;
  }

  const consent = buildConsentSnapshot({
    state: consentState,
    basis: "explicit_opt_in",
    capturedAt: new Date().toISOString(),
  });

  const retailer = await new RetailerRepository(args.client).findById(
    retailerId,
  );
  if (!retailer || retailer.status !== "active") return null;

  const retailerSettings =
    await args.deliveryRepo.getRetailerSettings(retailerId);
  if (!retailerSettings.enabled) return null;

  const storeCity = retailer.billingAddress.city;
  const locationGranted = isPurposeGranted(consentState, "location");
  const locationLabel = locationGranted ? storeCity : undefined;

  let weather: WeatherSnapshot | null = null;
  let weatherFailed = false;
  if (locationGranted && locationLabel) {
    try {
      weather = await args.weatherProvider.getCurrentWeather({ locationLabel });
    } catch {
      weatherFailed = true;
    }
  }

  let occasions: CalendarOccasion[] = [];
  let calendarFailed = false;
  try {
    const day = await args.calendarProvider.listOccasionsForDay({
      day: args.forDate,
      retailerId: args.retailerId,
      customerId: args.customerId,
    });
    occasions = [...day.occasions];
  } catch {
    calendarFailed = true;
  }

  let styleSignals: MorningRoutineStyleSignals | null = null;
  const profile = await new StyleProfileRepository(args.client).findByCustomer(
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

  const wardrobeRepo = new WardrobeRepository(args.client);
  const lifecycleRepo = new WardrobeLifecycleRepository(args.client);
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

  const products = await new ProductRepository(args.client).findByRetailer(
    retailerId,
  );
  const variantRepo = new ProductVariantRepository(args.client);
  const catalogue: MorningRoutineCatalogueCandidate[] = [];
  for (const product of products
    .filter((p) => p.status === "active")
    .slice(0, 24)) {
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

  const filteredCatalogue = filterCatalogueByEligibleProducts(
    catalogue,
    retailerSettings.eligibleProductIds.map(String),
  );

  const selected = attachRetailerSlugToActions(
    selectMorningRoutine({
      retailerId,
      customerId,
      forDate: args.forDate,
      consent,
      wardrobe,
      catalogue: filteredCatalogue,
      ...(styleSignals ? { styleProfile: styleSignals } : {}),
      ...(weather ? { weather } : {}),
      weatherStatus: statuses.weatherStatus,
      occasions,
      calendarStatus: statuses.calendarStatus,
      location: statuses.location,
      locationStatus: statuses.locationStatus,
      personalizationStatus: statuses.personalizationStatus,
    }),
    retailer.slug,
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
    args.client,
  ).persistSelection(persistPayload);
  return { selectionId };
}
