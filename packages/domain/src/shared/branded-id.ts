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
export type MorningRoutineSelectionId = Brand<
  string,
  "MorningRoutineSelectionId"
>;
export type MorningRoutineRecommendationId = Brand<
  string,
  "MorningRoutineRecommendationId"
>;
export type MorningRoutineSubscriptionId = Brand<
  string,
  "MorningRoutineSubscriptionId"
>;
export type MorningRoutineDeliveryAuditId = Brand<
  string,
  "MorningRoutineDeliveryAuditId"
>;
export type CampaignId = Brand<string, "CampaignId">;
export type CampaignAudienceRuleId = Brand<string, "CampaignAudienceRuleId">;
export type PrivateOfferId = Brand<string, "PrivateOfferId">;
export type CampaignChallengeEnrollmentId = Brand<
  string,
  "CampaignChallengeEnrollmentId"
>;
export type CampaignChallengeLookId = Brand<string, "CampaignChallengeLookId">;
export type CampaignChallengeLookSlotId = Brand<
  string,
  "CampaignChallengeLookSlotId"
>;
export type CampaignCompletionId = Brand<string, "CampaignCompletionId">;
export type CampaignRewardGrantId = Brand<string, "CampaignRewardGrantId">;
export type CampaignDeliveryAuditId = Brand<string, "CampaignDeliveryAuditId">;
export type OrderId = Brand<string, "OrderId">;
export type OrderLineId = Brand<string, "OrderLineId">;
export type ProductionOrderId = Brand<string, "ProductionOrderId">;
export type AlterationId = Brand<string, "AlterationId">;
export type AlterationUpdateId = Brand<string, "AlterationUpdateId">;
export type PhysicalGarmentId = Brand<string, "PhysicalGarmentId">;
export type FittingSessionId = Brand<string, "FittingSessionId">;
export type FittingObservationId = Brand<string, "FittingObservationId">;
export type FitProfileCandidateId = Brand<string, "FitProfileCandidateId">;
export type FitProfileCandidateActionId = Brand<
  string,
  "FitProfileCandidateActionId"
>;
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
export type LoyaltyMilestoneDefinitionId = Brand<
  string,
  "LoyaltyMilestoneDefinitionId"
>;
export type LoyaltyMilestoneAwardId = Brand<string, "LoyaltyMilestoneAwardId">;
export type ServicePlanId = Brand<string, "ServicePlanId">;
export type ServiceMembershipId = Brand<string, "ServiceMembershipId">;
export type ServiceEntitlementId = Brand<string, "ServiceEntitlementId">;
export type ServiceEntitlementEntryId = Brand<
  string,
  "ServiceEntitlementEntryId"
>;
export type ServiceBookingId = Brand<string, "ServiceBookingId">;
export type ServiceFulfilmentEventId = Brand<
  string,
  "ServiceFulfilmentEventId"
>;
export type ServiceCareRecordId = Brand<string, "ServiceCareRecordId">;
export type ServiceCostRecordId = Brand<string, "ServiceCostRecordId">;
export type ServiceHistoryEventId = Brand<string, "ServiceHistoryEventId">;
export type ServiceWeeklyPlanId = Brand<string, "ServiceWeeklyPlanId">;
export type ServiceWeeklyPlanDayId = Brand<string, "ServiceWeeklyPlanDayId">;
export type RewardId = Brand<string, "RewardId">;
export type RewardRedemptionId = Brand<string, "RewardRedemptionId">;
export type ReferralId = Brand<string, "ReferralId">;
export type EventId = Brand<string, "EventId">;
export type NotificationId = Brand<string, "NotificationId">;
export type MessageId = Brand<string, "MessageId">;
export type MessageAttachmentId = Brand<string, "MessageAttachmentId">;
export type ConversationId = Brand<string, "ConversationId">;
export type ConversationProposalId = Brand<string, "ConversationProposalId">;
export type WishlistId = Brand<string, "WishlistId">;
export type ClientelingNoteId = Brand<string, "ClientelingNoteId">;
export type SubscriptionId = Brand<string, "SubscriptionId">;
export type SubscriptionPlanId = Brand<string, "SubscriptionPlanId">;
export type PaymentId = Brand<string, "PaymentId">;
export type WeddingPartyId = Brand<string, "WeddingPartyId">;
export type WeddingPartyMemberId = Brand<string, "WeddingPartyMemberId">;
export type WeddingAftercarePlanId = Brand<string, "WeddingAftercarePlanId">;
export type SuitConfigurationIntentId = Brand<
  string,
  "SuitConfigurationIntentId"
>;
export type WeddingGroupFittingId = Brand<string, "WeddingGroupFittingId">;
export type WeddingInspirationItemId = Brand<
  string,
  "WeddingInspirationItemId"
>;
export type WeddingDesignChoiceId = Brand<string, "WeddingDesignChoiceId">;
export type WeddingDateCandidateId = Brand<string, "WeddingDateCandidateId">;
export type WeddingGuestVoucherId = Brand<string, "WeddingGuestVoucherId">;
export type StaffShiftId = Brand<string, "StaffShiftId">;
export type StaffTimeEntryId = Brand<string, "StaffTimeEntryId">;
export type BehavioralEventId = Brand<string, "BehavioralEventId">;
export type AnonymousSessionId = Brand<string, "AnonymousSessionId">;
export type InteractionSessionId = Brand<string, "InteractionSessionId">;
export type CustomerFactId = Brand<string, "CustomerFactId">;
export type RetailerBranchId = Brand<string, "RetailerBranchId">;
export type CustomerMomentId = Brand<string, "CustomerMomentId">;
export type AppointmentCloseoutId = Brand<string, "AppointmentCloseoutId">;
export type CustomerConsentEventId = Brand<string, "CustomerConsentEventId">;
export type CustomerStyleProfileId = Brand<string, "CustomerStyleProfileId">;
export type StylePreferenceEvidenceId = Brand<
  string,
  "StylePreferenceEvidenceId"
>;
export type GiftExperienceId = Brand<string, "GiftExperienceId">;
export type GiftCuratedItemId = Brand<string, "GiftCuratedItemId">;
export type GiftInvitationId = Brand<string, "GiftInvitationId">;
export type CorporateAccountId = Brand<string, "CorporateAccountId">;
export type CorporateProgrammeId = Brand<string, "CorporateProgrammeId">;
export type CorporateEntitlementVersionId = Brand<
  string,
  "CorporateEntitlementVersionId"
>;
export type CorporateWearerId = Brand<string, "CorporateWearerId">;
export type CorporateIssueRecordId = Brand<string, "CorporateIssueRecordId">;
export type CorporateExceptionId = Brand<string, "CorporateExceptionId">;
export type CorporateAnnouncementId = Brand<string, "CorporateAnnouncementId">;
export type CorporateOpportunityId = Brand<string, "CorporateOpportunityId">;
export type CorporateOpportunitySignalId = Brand<
  string,
  "CorporateOpportunitySignalId"
>;
export type CorporateTenderId = Brand<string, "CorporateTenderId">;
export type CorporateTenderVersionId = Brand<
  string,
  "CorporateTenderVersionId"
>;
export type CorporateTenderApprovalId = Brand<
  string,
  "CorporateTenderApprovalId"
>;
export type CorporateOfficeVisitRequestId = Brand<
  string,
  "CorporateOfficeVisitRequestId"
>;
export type CorporateRolloutDayId = Brand<string, "CorporateRolloutDayId">;
export type CorporateRolloutSlotId = Brand<string, "CorporateRolloutSlotId">;
export type CorporateProjectId = Brand<string, "CorporateProjectId">;
export type CorporateProjectEventId = Brand<string, "CorporateProjectEventId">;
export type CorporateConceptAssetId = Brand<string, "CorporateConceptAssetId">;
export type MicroCapsuleDropId = Brand<string, "MicroCapsuleDropId">;
export type MicroCapsuleDropProductId = Brand<
  string,
  "MicroCapsuleDropProductId"
>;
export type ServicePartnerId = Brand<string, "ServicePartnerId">;
export type ServicePartnerEngagementId = Brand<
  string,
  "ServicePartnerEngagementId"
>;
export type ServicePartnerCustodyEventId = Brand<
  string,
  "ServicePartnerCustodyEventId"
>;
export type ServicePartnerInvoiceId = Brand<string, "ServicePartnerInvoiceId">;
export type ServicePartnerInvoiceLineId = Brand<
  string,
  "ServicePartnerInvoiceLineId"
>;
export type ConceptScanCodeId = Brand<string, "ConceptScanCodeId">;
export type ConceptOrderSelectionId = Brand<string, "ConceptOrderSelectionId">;
export type ConceptOrderSelectionItemId = Brand<
  string,
  "ConceptOrderSelectionItemId"
>;
export type SilhouetteAnalysisSessionId = Brand<
  string,
  "SilhouetteAnalysisSessionId"
>;
export type SilhouetteAnalysisCaptureId = Brand<
  string,
  "SilhouetteAnalysisCaptureId"
>;
export type StylePortraitId = Brand<string, "StylePortraitId">;
export type StylePortraitReferenceId = Brand<
  string,
  "StylePortraitReferenceId"
>;
export type RetailerVisualPresetId = Brand<string, "RetailerVisualPresetId">;
export type WardrobeVisualizationJobId = Brand<
  string,
  "WardrobeVisualizationJobId"
>;
export type WardrobeVisualizationFeedbackId = Brand<
  string,
  "WardrobeVisualizationFeedbackId"
>;
export type VirtualTryOnUsageLedgerId = Brand<
  string,
  "VirtualTryOnUsageLedgerId"
>;
export type MtmPriceComponentId = Brand<string, "MtmPriceComponentId">;
export type MtmPriceQuoteId = Brand<string, "MtmPriceQuoteId">;
export type CorporateVisitSlotId = Brand<string, "CorporateVisitSlotId">;
export type CustomerIntakeSessionId = Brand<string, "CustomerIntakeSessionId">;
export type CustomerIntakeProposalId = Brand<
  string,
  "CustomerIntakeProposalId"
>;
export type PaidCareServicePriceId = Brand<string, "PaidCareServicePriceId">;
export type PaidCareBookingId = Brand<string, "PaidCareBookingId">;

export function asId<T extends string>(value: string): Brand<string, T> {
  return value as Brand<string, T>;
}
