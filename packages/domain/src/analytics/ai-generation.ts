import type { CustomerId, RetailerId, StaffId } from "../shared/branded-id";

/**
 * AI personalisation built on `BehavioralEvent` (founder decision:
 * OpenAI behind a provider-neutral interface, `@paon/ai`). Every
 * generation attempt is recorded, success or failure — this doubles as
 * the PAON Admin monitoring surface (`docs/PRODUCT.md`) and the
 * per-customer history shown in Retailer Portal. See
 * docs/DECISIONS.md ADR-033.
 */
export type AIGenerationKind =
  "next_best_action" | "product_recommendation" | "communication_draft";

export type AIGenerationStatus = "succeeded" | "failed";

export interface AIGeneration {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly customerId?: CustomerId;
  readonly requestedByStaffId?: StaffId;
  readonly kind: AIGenerationKind;
  readonly status: AIGenerationStatus;
  readonly provider: string;
  readonly model: string;
  readonly inputSummary: string;
  readonly output?: Record<string, unknown>;
  readonly errorMessage?: string;
  readonly latencyMs?: number;
  readonly createdAt: string;
}
