import type { RetailerId } from "./branded-id";

/**
 * Every persisted entity carries these. Soft-delete via deletedAt, never
 * hard-delete rows that a retailer's business history depends on
 * (orders, production, loyalty ledger).
 */
export interface Timestamps {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string | null;
}

/** Every entity that belongs to exactly one retailer tenant. */
export interface TenantScoped {
  readonly retailerId: RetailerId;
}
