/**
 * Wardrobe ownership and collaboration (WARD-001/002/003, ADR-063 / PHASE 4.1).
 * Customer-visible items stay relationship-scoped; PhysicalGarment remains the
 * official fitting/service aggregate.
 */

import type { GarmentCategoryCode } from "../production/production";
import type {
  CustomerId,
  OrderLineId,
  PhysicalGarmentId,
  ProductId,
  RetailerId,
  StaffId,
  WardrobeItemId,
  WardrobeOwnershipEventId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export const WARDROBE_OWNERSHIP_SOURCES = [
  "retailer_purchase",
  "external",
] as const;

export type WardrobeOwnershipSource =
  (typeof WARDROBE_OWNERSHIP_SOURCES)[number];

export const WARDROBE_CONDITION_STATES = [
  "excellent",
  "good",
  "fair",
  "worn",
  "needs_repair",
] as const;

export type WardrobeConditionState = (typeof WARDROBE_CONDITION_STATES)[number];

export const WARDROBE_WEAR_FREQUENCIES = [
  "rarely",
  "sometimes",
  "often",
  "daily",
] as const;

export type WardrobeWearFrequency = (typeof WARDROBE_WEAR_FREQUENCIES)[number];

export const WARDROBE_HISTORY_EVENT_TYPES = [
  "created",
  "state_updated",
  "advisor_note",
  "archived",
  "restored",
] as const;

export type WardrobeHistoryEventType =
  (typeof WARDROBE_HISTORY_EVENT_TYPES)[number];

export const WARDROBE_HISTORY_ACTOR_TYPES = ["customer", "advisor"] as const;

export type WardrobeHistoryActorType =
  (typeof WARDROBE_HISTORY_ACTOR_TYPES)[number];

export interface WardrobeItemState {
  readonly conditionState: WardrobeConditionState;
  readonly fitNotes?: string;
  readonly careNotes?: string;
  readonly wearFrequency?: WardrobeWearFrequency;
  readonly lastWornAt?: string;
}

export interface WardrobeItem extends Timestamps {
  readonly id: WardrobeItemId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly ownershipSource: WardrobeOwnershipSource;
  readonly categoryCode: GarmentCategoryCode;
  readonly title: string;
  readonly description?: string;
  readonly brand?: string;
  readonly photoUrl?: string;
  readonly productId?: ProductId;
  readonly orderLineId?: OrderLineId;
  readonly physicalGarmentId?: PhysicalGarmentId;
  readonly state: WardrobeItemState;
  readonly archivedAt?: string;
}

export interface WardrobeOwnershipEvent {
  readonly id: WardrobeOwnershipEventId;
  readonly wardrobeItemId: WardrobeItemId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly eventType: WardrobeHistoryEventType;
  readonly actorType: WardrobeHistoryActorType;
  readonly actorStaffId?: StaffId;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface CreateExternalWardrobeItemInput {
  readonly categoryCode: GarmentCategoryCode;
  readonly title: string;
  readonly description?: string;
  readonly brand?: string;
  readonly photoUrl?: string;
  readonly conditionState?: WardrobeConditionState;
  readonly fitNotes?: string;
  readonly careNotes?: string;
  readonly wearFrequency?: WardrobeWearFrequency;
}

export interface CreateRetailerPurchaseWardrobeItemInput {
  readonly categoryCode: GarmentCategoryCode;
  readonly title: string;
  readonly description?: string;
  readonly brand?: string;
  readonly photoUrl?: string;
  readonly productId?: ProductId;
  readonly orderLineId?: OrderLineId;
  readonly physicalGarmentId?: PhysicalGarmentId;
  readonly conditionState?: WardrobeConditionState;
  readonly fitNotes?: string;
  readonly careNotes?: string;
  readonly wearFrequency?: WardrobeWearFrequency;
}

export interface UpdateWardrobeItemStateInput {
  readonly conditionState?: WardrobeConditionState;
  readonly fitNotes?: string;
  readonly careNotes?: string;
  readonly wearFrequency?: WardrobeWearFrequency;
  readonly lastWornAt?: string;
}

export interface AddWardrobeAdvisorNoteInput {
  readonly note: string;
}

export function isWardrobeOwnershipSource(
  value: string,
): value is WardrobeOwnershipSource {
  return (WARDROBE_OWNERSHIP_SOURCES as readonly string[]).includes(value);
}

export function isWardrobeConditionState(
  value: string,
): value is WardrobeConditionState {
  return (WARDROBE_CONDITION_STATES as readonly string[]).includes(value);
}

export function wardrobeOwnershipLabel(
  source: WardrobeOwnershipSource,
): string {
  if (source === "retailer_purchase") return "Purchased here";
  return "Added by you";
}

export function wardrobeConditionLabel(state: WardrobeConditionState): string {
  if (state === "excellent") return "Excellent";
  if (state === "good") return "Good";
  if (state === "fair") return "Fair";
  if (state === "worn") return "Well worn";
  return "Needs repair";
}

/**
 * External wardrobe items must not silently become catalogue products.
 */
export function externalWardrobeItemMayLinkCatalogue(
  input: CreateExternalWardrobeItemInput & {
    readonly productId?: ProductId;
    readonly orderLineId?: OrderLineId;
  },
): boolean {
  return input.productId === undefined && input.orderLineId === undefined;
}
