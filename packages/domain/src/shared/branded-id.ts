/**
 * Branded string IDs. Every entity ID in the domain is a distinct nominal
 * type — a CustomerId can never be passed where a RetailerId is expected,
 * even though both are UUID strings at runtime. This is the single
 * biggest source of cross-tenant bugs we can eliminate at compile time.
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type RetailerId = Brand<string, "RetailerId">;
export type StaffId = Brand<string, "StaffId">;
export type CustomerId = Brand<string, "CustomerId">;
export type UserId = Brand<string, "UserId">;
export type ProductId = Brand<string, "ProductId">;
export type ProductVariantId = Brand<string, "ProductVariantId">;
export type CollectionId = Brand<string, "CollectionId">;
export type MetadataConceptId = Brand<string, "MetadataConceptId">;
export type MetadataConceptEdgeId = Brand<string, "MetadataConceptEdgeId">;
export type EntityMetadataAssignmentId = Brand<
  string,
  "EntityMetadataAssignmentId"
>;
export type MetadataAssignmentReviewId = Brand<
  string,
  "MetadataAssignmentReviewId"
>;
export type RetailerConceptOverrideId = Brand<
  string,
  "RetailerConceptOverrideId"
>;
export type KnowledgeObjectId = Brand<string, "KnowledgeObjectId">;
export type KnowledgeObjectConceptId = Brand<
  string,
  "KnowledgeObjectConceptId"
>;
export type KnowledgeObjectRelationId = Brand<
  string,
  "KnowledgeObjectRelationId"
>;
export type RetailerKnowledgeOverrideId = Brand<
  string,
  "RetailerKnowledgeOverrideId"
>;
export type CatalogueImportId = Brand<string, "CatalogueImportId">;
export type CatalogueImportRowId = Brand<string, "CatalogueImportRowId">;
export type MetadataReviewTaskId = Brand<string, "MetadataReviewTaskId">;
export type WardrobeItemId = Brand<string, "WardrobeItemId">;
export type WardrobeOwnershipEventId = Brand<
  string,
  "WardrobeOwnershipEventId"
>;
export type SartorialRuleId = Brand<string, "SartorialRuleId">;
export type OutfitId = Brand<string, "OutfitId">;
export type OutfitSlotId = Brand<string, "OutfitSlotId">;
export type WardrobeRoadmapId = Brand<string, "WardrobeRoadmapId">;
export type WardrobeRoadmapGoalId = Brand<string, "WardrobeRoadmapGoalId">;
export type WardrobeRoadmapGapId = Brand<string, "WardrobeRoadmapGapId">;
export type WardrobeRoadmapStageId = Brand<string, "WardrobeRoadmapStageId">;
export type WardrobeLifecycleEventId = Brand<
  string,
  "WardrobeLifecycleEventId"
>;
export type WardrobeSelfScanId = Brand<string, "WardrobeSelfScanId">;
export type WardrobeAttachmentId = Brand<string, "WardrobeAttachmentId">;
export type OrderId = Brand<string, "OrderId">;
export type OrderLineId = Brand<string, "OrderLineId">;
export type ProductionOrderId = Brand<string, "ProductionOrderId">;
export type AlterationId = Brand<string, "AlterationId">;
export type AlterationUpdateId = Brand<string, "AlterationUpdateId">;
export type PhysicalGarmentId = Brand<string, "PhysicalGarmentId">;
export type FittingSessionId = Brand<string, "FittingSessionId">;
export type FittingObservationId = Brand<string, "FittingObservationId">;
export type AlterationTaskId = Brand<string, "AlterationTaskId">;
export type AlterationTaskNoteId = Brand<string, "AlterationTaskNoteId">;
export type AlterationStatusHistoryId = Brand<
  string,
  "AlterationStatusHistoryId"
>;
export type AlterationCategoryId = Brand<string, "AlterationCategoryId">;
export type AlterationOperationId = Brand<string, "AlterationOperationId">;
export type AlterationPriceListId = Brand<string, "AlterationPriceListId">;
export type AlterationPriceListItemId = Brand<
  string,
  "AlterationPriceListItemId"
>;
export type WorkshopId = Brand<string, "WorkshopId">;
export type WorkOrderAssignmentId = Brand<string, "WorkOrderAssignmentId">;
export type PriceChangeProposalId = Brand<string, "PriceChangeProposalId">;
export type AlterationAttachmentId = Brand<string, "AlterationAttachmentId">;
export type ChainOfCustodyEventId = Brand<string, "ChainOfCustodyEventId">;
export type CompletionReviewId = Brand<string, "CompletionReviewId">;
export type FulfillmentEventId = Brand<string, "FulfillmentEventId">;
export type AppointmentId = Brand<string, "AppointmentId">;
export type AvailabilityWindowId = Brand<string, "AvailabilityWindowId">;
export type LoyaltyAccountId = Brand<string, "LoyaltyAccountId">;
export type LoyaltyProgramId = Brand<string, "LoyaltyProgramId">;
export type LoyaltyLedgerEntryId = Brand<string, "LoyaltyLedgerEntryId">;
export type RewardId = Brand<string, "RewardId">;
export type RewardRedemptionId = Brand<string, "RewardRedemptionId">;
export type ReferralId = Brand<string, "ReferralId">;
export type EventId = Brand<string, "EventId">;
export type NotificationId = Brand<string, "NotificationId">;
export type MessageId = Brand<string, "MessageId">;
export type MessageAttachmentId = Brand<string, "MessageAttachmentId">;
export type ConversationId = Brand<string, "ConversationId">;
export type WishlistId = Brand<string, "WishlistId">;
export type ClientelingNoteId = Brand<string, "ClientelingNoteId">;
export type SubscriptionId = Brand<string, "SubscriptionId">;
export type SubscriptionPlanId = Brand<string, "SubscriptionPlanId">;
export type PaymentId = Brand<string, "PaymentId">;
export type WeddingPartyId = Brand<string, "WeddingPartyId">;
export type WeddingPartyMemberId = Brand<string, "WeddingPartyMemberId">;
export type StaffShiftId = Brand<string, "StaffShiftId">;
export type StaffTimeEntryId = Brand<string, "StaffTimeEntryId">;
export type BehavioralEventId = Brand<string, "BehavioralEventId">;
export type AnonymousSessionId = Brand<string, "AnonymousSessionId">;
export type CustomerConsentEventId = Brand<string, "CustomerConsentEventId">;
export type CustomerStyleProfileId = Brand<string, "CustomerStyleProfileId">;
export type StylePreferenceEvidenceId = Brand<
  string,
  "StylePreferenceEvidenceId"
>;

export function asId<T extends string>(value: string): Brand<string, T> {
  return value as Brand<string, T>;
}
