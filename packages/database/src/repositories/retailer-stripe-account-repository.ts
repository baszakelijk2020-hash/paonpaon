import {
  asId,
  type RetailerId,
  type RetailerStripeAccount,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type RetailerStripeAccountRow =
  Database["public"]["Tables"]["retailer_stripe_accounts"]["Row"];

function toDomain(row: RetailerStripeAccountRow): RetailerStripeAccount {
  return {
    retailerId: asId<"RetailerId">(row.retailer_id),
    stripeAccountId: row.stripe_account_id,
    chargesEnabled: row.charges_enabled,
    payoutsEnabled: row.payouts_enabled,
    detailsSubmitted: row.details_submitted,
    platformFeeBasisPoints: row.platform_fee_basis_points,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** See `docs/ARCHITECTURE.md` "Data access layer" — this repository is the only code allowed to query `retailer_stripe_accounts`. */
export class RetailerStripeAccountRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByRetailer(
    retailerId: RetailerId,
  ): Promise<RetailerStripeAccount | null> {
    const { data, error } = await this.client
      .from("retailer_stripe_accounts")
      .select("*")
      .eq("retailer_id", retailerId)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  /** Called once, right after the real Stripe Express account is created — see `apps/retailer`'s `connectStripeAccount` action. */
  async create(
    retailerId: RetailerId,
    stripeAccountId: string,
  ): Promise<RetailerStripeAccount> {
    const { data, error } = await this.client
      .from("retailer_stripe_accounts")
      .insert({ retailer_id: retailerId, stripe_account_id: stripeAccountId })
      .select("*")
      .single();
    if (error) throw error;
    return toDomain(data);
  }

  /** Service-role only, driven by the `account.updated` Stripe webhook — never client-triggered. */
  async syncCapabilities(
    stripeAccountId: string,
    status: {
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      detailsSubmitted: boolean;
    },
  ): Promise<void> {
    const { error } = await this.client
      .from("retailer_stripe_accounts")
      .update({
        charges_enabled: status.chargesEnabled,
        payouts_enabled: status.payoutsEnabled,
        details_submitted: status.detailsSubmitted,
      })
      .eq("stripe_account_id", stripeAccountId);
    if (error) throw error;
  }

  /** Platform-staff-only — see `RetailerStripeAccount.platformFeeBasisPoints`. */
  async updatePlatformFee(
    retailerId: RetailerId,
    platformFeeBasisPoints: number,
  ): Promise<void> {
    const { error } = await this.client
      .from("retailer_stripe_accounts")
      .update({ platform_fee_basis_points: platformFeeBasisPoints })
      .eq("retailer_id", retailerId);
    if (error) throw error;
  }
}
