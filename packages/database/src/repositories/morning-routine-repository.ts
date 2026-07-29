/**
 * MorningRoutine projection (MR-001 / MR-002 / PHASE 4.4). Composes
 * wardrobe, catalogue, consent, StyleProfile, and provider-neutral weather/
 * calendar inputs into deterministic selection results.
 */

import {
  appendCatalogueProvenance,
  appendStyleProfileProvenance,
  appendWardrobeProvenance,
  APPOINTMENT_TYPE_LABELS,
  isPurposeGranted,
  projectWardrobeCandidate,
  selectMorningRoutineRecommendations,
  type CustomerId,
  type MorningRoutineCalendarProvider,
  type MorningRoutineCatalogueCandidate,
  type MorningRoutineInputProvenanceEntry,
  type MorningRoutineSelectionResult,
  type MorningRoutineWeatherProvider,
  type OutfitSlotKind,
  type Product,
  type ProductVariant,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

import { AppointmentRepository } from "./appointment-repository";
import { CustomerConsentRepository } from "./customer-consent-repository";
import { MetadataRepository } from "./metadata-repository";
import { ProductRepository } from "./product-repository";
import { ProductVariantRepository } from "./product-variant-repository";
import { RetailerRepository } from "./retailer-repository";
import { StyleProfileRepository } from "./style-profile-repository";
import { WardrobeRepository } from "./wardrobe-repository";

export interface MorningRoutineBuildRequest {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly slug: string;
  readonly declaredOccasion?: string;
  readonly preciseCity?: string;
}

export interface MorningRoutineRepositoryDeps {
  readonly retailers: RetailerRepository;
  readonly wardrobe: WardrobeRepository;
  readonly products: ProductRepository;
  readonly variants: ProductVariantRepository;
  readonly metadata: MetadataRepository;
  readonly consent: CustomerConsentRepository;
  readonly styleProfile: StyleProfileRepository;
  readonly appointments: AppointmentRepository;
  readonly weather: MorningRoutineWeatherProvider;
  readonly calendar: MorningRoutineCalendarProvider;
}

const SLOT_NAME_HINTS: readonly {
  readonly hint: string;
  readonly slot: OutfitSlotKind;
}[] = [
  { hint: "jacket", slot: "jacket" },
  { hint: "blazer", slot: "jacket" },
  { hint: "suit", slot: "jacket" },
  { hint: "coat", slot: "jacket" },
  { hint: "trouser", slot: "trousers" },
  { hint: "pant", slot: "trousers" },
  { hint: "chino", slot: "trousers" },
  { hint: "shirt", slot: "shirt" },
  { hint: "oxford", slot: "shirt" },
  { hint: "shoe", slot: "shoes" },
  { hint: "loafer", slot: "shoes" },
  { hint: "derby", slot: "shoes" },
  { hint: "tie", slot: "accessories" },
  { hint: "pocket square", slot: "pocket_square" },
];

function inferCatalogueSlot(product: Product): OutfitSlotKind | null {
  const haystack = `${product.name} ${product.description}`.toLowerCase();
  for (const { hint, slot } of SLOT_NAME_HINTS) {
    if (haystack.includes(hint)) return slot;
  }
  return null;
}

function variantAvailable(variant: ProductVariant): boolean {
  return variant.inventoryQuantity === null || variant.inventoryQuantity > 0;
}

export class MorningRoutineRepository {
  private readonly deps: MorningRoutineRepositoryDeps;

  constructor(
    client: PaonSupabaseClient,
    deps?: Partial<MorningRoutineRepositoryDeps>,
  ) {
    this.deps = {
      retailers: deps?.retailers ?? new RetailerRepository(client),
      wardrobe: deps?.wardrobe ?? new WardrobeRepository(client),
      products: deps?.products ?? new ProductRepository(client),
      variants: deps?.variants ?? new ProductVariantRepository(client),
      metadata: deps?.metadata ?? new MetadataRepository(client),
      consent: deps?.consent ?? new CustomerConsentRepository(client),
      styleProfile: deps?.styleProfile ?? new StyleProfileRepository(client),
      appointments: deps?.appointments ?? new AppointmentRepository(client),
      weather: deps?.weather ?? {
        async fetch() {
          return {
            weather: null,
            provenance: {
              input: "unavailable",
              used: false,
              detail: "Weather provider not configured",
            },
          };
        },
      },
      calendar: deps?.calendar ?? {
        async fetch() {
          return {
            occasion: null,
            provenance: {
              input: "unavailable",
              used: false,
              detail: "Calendar provider not configured",
            },
          };
        },
      },
    };
  }

  async buildRoutine(
    request: MorningRoutineBuildRequest,
  ): Promise<MorningRoutineSelectionResult | null> {
    const retailer = await this.deps.retailers.findById(request.retailerId);
    if (!retailer || retailer.status !== "active") return null;

    const [consent, wardrobeItems, products, styleProfileRow] =
      await Promise.all([
        this.deps.consent.getState(request.retailerId, request.customerId),
        this.deps.wardrobe.findByCustomer(request.customerId),
        this.deps.products.findByRetailer(request.retailerId),
        this.deps.styleProfile.findByCustomer(
          request.retailerId,
          request.customerId,
        ),
      ]);

    const wardrobeCandidates = wardrobeItems
      .map((item) => projectWardrobeCandidate(item))
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      );

    const activeProducts = products.filter(
      (product) => product.status === "active" && !product.deletedAt,
    );
    const catalogueCandidates: MorningRoutineCatalogueCandidate[] = [];

    for (const product of activeProducts) {
      const slotKind = inferCatalogueSlot(product);
      if (!slotKind) continue;
      const variants = await this.deps.variants.findByProduct(product.id);
      const availableVariant = variants.find(variantAvailable);
      if (!availableVariant) continue;

      const assignments = await this.deps.metadata.findAssignmentsForTarget(
        request.retailerId,
        { targetType: "product", targetId: product.id },
      );
      const acceptedConceptIds = assignments
        .filter((assignment) => assignment.reviewStatus === "accepted")
        .map((assignment) => assignment.conceptId);

      catalogueCandidates.push({
        kind: "catalogue_product",
        productId: product.id,
        productVariantId: availableVariant.id,
        label: product.name,
        slug: product.slug,
        slotKind,
        available: true,
        priceCents: availableVariant.price.amountMinorUnits,
        ...(product.primaryImageUrl
          ? { imageUrl: product.primaryImageUrl }
          : {}),
        ...(acceptedConceptIds.length > 0
          ? { matchedConceptIds: acceptedConceptIds }
          : {}),
      });
    }

    const locationGranted = isPurposeGranted(consent, "location");
    const fallbackCity = retailer.billingAddress.city;
    const weatherResult = await this.deps.weather.fetch({
      retailerId: request.retailerId,
      fallbackCity,
      locationGranted,
      ...(locationGranted && request.preciseCity
        ? { preciseCity: request.preciseCity }
        : {}),
    });

    const calendarResult = await this.deps.calendar.fetch({
      retailerId: request.retailerId,
      customerId: request.customerId,
      ...(request.declaredOccasion
        ? { declaredOccasion: request.declaredOccasion }
        : {}),
    });

    const provenance: MorningRoutineInputProvenanceEntry[] = [
      appendWardrobeProvenance(
        wardrobeCandidates.filter((c) => c.available).length,
      ),
      appendCatalogueProvenance(catalogueCandidates.length),
      appendStyleProfileProvenance({
        consent,
        ...(styleProfileRow ? { styleProfile: styleProfileRow } : {}),
      }),
      weatherResult.provenance,
      calendarResult.provenance,
      {
        input: locationGranted ? "location" : "retailer_default",
        used: Boolean(weatherResult.weather),
        detail: locationGranted
          ? "Location consent granted for weather lookup"
          : "Using retailer default city for weather fallback",
      },
    ];

    return selectMorningRoutineRecommendations({
      retailerId: request.retailerId,
      customerId: request.customerId,
      consent,
      slug: request.slug,
      wardrobe: wardrobeCandidates,
      catalogue: catalogueCandidates,
      ...(styleProfileRow ? { styleProfile: styleProfileRow } : {}),
      weather: weatherResult.weather,
      occasion: calendarResult.occasion,
      provenance,
    });
  }
}

/** Appointment-backed calendar provider for the Customer Environment. */
export function appointmentCalendarProvider(
  appointments: AppointmentRepository,
): MorningRoutineCalendarProvider {
  return {
    async fetch(request) {
      if (request.declaredOccasion?.trim()) {
        return {
          occasion: {
            label: request.declaredOccasion.trim(),
            startsAt: new Date().toISOString(),
            source: "customer_declared",
          },
          provenance: {
            input: "calendar",
            used: true,
            detail: "Customer-declared occasion for this routine",
          },
        };
      }

      const rows = await appointments.findByCustomer(request.customerId);
      const now = Date.now();
      const upcoming = rows
        .filter(
          (appointment) =>
            appointment.retailerId === request.retailerId &&
            !["completed", "canceled", "no_show"].includes(
              appointment.status,
            ) &&
            new Date(appointment.startsAt).getTime() >= now,
        )
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )[0];

      if (!upcoming) {
        return {
          occasion: null,
          provenance: {
            input: "unavailable",
            used: false,
            detail: "No upcoming appointment or declared occasion",
          },
        };
      }

      return {
        occasion: {
          label: APPOINTMENT_TYPE_LABELS[upcoming.type],
          startsAt: upcoming.startsAt,
          source: "appointment",
        },
        provenance: {
          input: "calendar",
          used: true,
          detail: "Upcoming appointment used as occasion context",
        },
      };
    },
  };
}
