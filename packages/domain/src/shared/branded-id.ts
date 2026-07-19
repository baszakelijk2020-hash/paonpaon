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
export type OrderId = Brand<string, "OrderId">;
export type OrderLineId = Brand<string, "OrderLineId">;
export type ProductionOrderId = Brand<string, "ProductionOrderId">;
export type AlterationId = Brand<string, "AlterationId">;
export type AlterationUpdateId = Brand<string, "AlterationUpdateId">;
export type AppointmentId = Brand<string, "AppointmentId">;
export type AvailabilityWindowId = Brand<string, "AvailabilityWindowId">;
export type CustomerFitProfileEntryId = Brand<
  string,
  "CustomerFitProfileEntryId"
>;
export type LoyaltyAccountId = Brand<string, "LoyaltyAccountId">;
export type RewardId = Brand<string, "RewardId">;
export type ReferralId = Brand<string, "ReferralId">;
export type EventId = Brand<string, "EventId">;
export type NotificationId = Brand<string, "NotificationId">;
export type MessageId = Brand<string, "MessageId">;
export type ConversationId = Brand<string, "ConversationId">;
export type WishlistId = Brand<string, "WishlistId">;
export type ClientelingNoteId = Brand<string, "ClientelingNoteId">;
export type SubscriptionId = Brand<string, "SubscriptionId">;
export type SubscriptionPlanId = Brand<string, "SubscriptionPlanId">;

export function asId<T extends string>(value: string): Brand<string, T> {
  return value as Brand<string, T>;
}
