/**
 * Deterministic linked multi-role seed descriptor for the programme harness
 * (AUD-003 / AUD-004). The proof house is deliberately separate from Maison
 * Dubois demo data and from the generic E2E workspace: verification may
 * mutate it without changing the founder walkthrough or onboarding demos.
 */

export const PROGRAMME_PROOF_SEED_ID = "paon-programme-proof-house-v2" as const;

export const PROGRAMME_PROOF_RETAILER_SLUG = "paon-programme-proof" as const;

export const PROGRAMME_PROOF_PERSONAS = {
  owner: {
    role: "owner",
    email: "contact+paon-programme-proof-owner@nebelspiegel.com",
  },
  manager: {
    role: "manager",
    email: "contact+paon-programme-proof-manager@nebelspiegel.com",
  },
  advisor: {
    role: "sales_associate",
    email: "contact+paon-programme-proof-sales@nebelspiegel.com",
  },
  worker: {
    role: "worker",
    email: "contact+paon-programme-proof-alteration-worker@nebelspiegel.com",
  },
  customer: {
    role: "customer",
    email: "contact+paon-programme-proof-julien@nebelspiegel.com",
    displayName: "Julien Moreau",
  },
} as const;

/** Stable note / appointment markers used by browser + DB assertions. */
export const PROGRAMME_PROOF_MARKERS = {
  pinnedNoteFragment: "VIP — private-client evenings preferred",
  appointmentMarker: "Demo: Julien delivery fitting",
  appointmentType: "fitting",
  appointmentStatus: "requested",
} as const;

export interface ProgrammeProofSeedDescriptor {
  readonly seedId: typeof PROGRAMME_PROOF_SEED_ID;
  readonly retailerSlug: typeof PROGRAMME_PROOF_RETAILER_SLUG;
  readonly personas: typeof PROGRAMME_PROOF_PERSONAS;
  readonly markers: typeof PROGRAMME_PROOF_MARKERS;
  readonly journey: {
    readonly originRole: "sales_associate";
    readonly receiverRole: "manager";
    readonly customerSurface: "appointments";
    readonly deniedRole: "worker";
    readonly persistedObject: "appointment+clienteling_note";
  };
}

export function getProgrammeProofSeedDescriptor(): ProgrammeProofSeedDescriptor {
  return {
    seedId: PROGRAMME_PROOF_SEED_ID,
    retailerSlug: PROGRAMME_PROOF_RETAILER_SLUG,
    personas: PROGRAMME_PROOF_PERSONAS,
    markers: PROGRAMME_PROOF_MARKERS,
    journey: {
      originRole: "sales_associate",
      receiverRole: "manager",
      customerSurface: "appointments",
      deniedRole: "worker",
      persistedObject: "appointment+clienteling_note",
    },
  };
}
