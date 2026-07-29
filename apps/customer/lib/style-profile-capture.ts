"use server";

import {
  MetadataRepository,
  StyleProfileRepository,
  type PaonSupabaseClient,
} from "@paon/database";
import {
  asId,
  type CustomerId,
  type InteractionEventName,
  type MetadataConceptId,
  type RetailerId,
} from "@paon/domain";

/** Best-effort StyleProfile evidence from a captured interaction event. */
export async function recordStyleEvidenceForInteraction(args: {
  readonly supabase: PaonSupabaseClient;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly personalizationGranted: boolean;
  readonly eventId: string;
  readonly name: InteractionEventName;
  readonly properties: Readonly<Record<string, unknown>>;
}): Promise<void> {
  if (!args.personalizationGranted) return;

  let acceptedConceptIds: MetadataConceptId[] | undefined;
  const productId = args.properties["productId"];
  if (typeof productId === "string") {
    const metadataRepo = new MetadataRepository(args.supabase);
    const assignments = await metadataRepo.findAssignmentsForTarget(
      args.retailerId,
      {
        targetType: "product",
        targetId: asId<"ProductId">(productId),
      },
    );
    acceptedConceptIds = assignments
      .filter((assignment) => assignment.reviewStatus === "accepted")
      .map((assignment) => assignment.conceptId);
  }

  try {
    await new StyleProfileRepository(args.supabase).recordInteractionEvidence({
      retailerId: args.retailerId,
      customerId: args.customerId,
      personalizationGranted: args.personalizationGranted,
      eventId: args.eventId,
      name: args.name,
      properties: args.properties,
      ...(acceptedConceptIds && acceptedConceptIds.length > 0
        ? { acceptedConceptIds }
        : {}),
    });
  } catch {
    // Style evidence must never block browsing or saves.
  }
}
