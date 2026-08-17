import type {
  AccountType,
  CustomerId,
  PlatformRole,
  RetailerId,
  RetailerRole,
  UserId,
} from "@paon/domain";

/**
 * Normalized session shape every app derives from the Supabase auth
 * user's `app_metadata` claims — the same claims RLS policies read
 * (see docs/DATABASE.md "Row Level Security"). Each app's middleware
 * rejects a session whose accountType doesn't match that app.
 */
export interface AppSession {
  readonly userId: UserId;
  readonly email: string;
  readonly accountType: AccountType;
  readonly platformRole?: PlatformRole;
  readonly retailerId?: RetailerId;
  readonly retailerRole?: RetailerRole;
  readonly customerId?: CustomerId;
  /** Set only when `accountType` is `corporate_wearer` (PHASE 18.5). */
  readonly wearerId?: string;
  /** Set only when `accountType` is `corporate_manager` (PHASE 14.1). */
  readonly managerId?: string;
}

/** Minimal shape of the Supabase auth user this package needs — avoids a hard dependency on @supabase/supabase-js's full type surface. */
export interface AuthUserLike {
  readonly id: string;
  readonly email?: string | null | undefined;
  readonly app_metadata: Record<string, unknown>;
}

function asPlatformRole(value: unknown): PlatformRole | undefined {
  return typeof value === "string" ? (value as PlatformRole) : undefined;
}

function asRetailerRole(value: unknown): RetailerRole | undefined {
  return typeof value === "string" ? (value as RetailerRole) : undefined;
}

function asRetailerId(value: unknown): RetailerId | undefined {
  return typeof value === "string" ? (value as RetailerId) : undefined;
}

function asCustomerId(value: unknown): CustomerId | undefined {
  return typeof value === "string" ? (value as CustomerId) : undefined;
}

function asWearerId(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asManagerId(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Maps a Supabase auth user onto an `AppSession`. accountType is
 * derived from which claim is present — platform_role wins over
 * retailer claims, which win over the manager claim, which wins over the
 * wearer claim, which wins over the customer default — because a
 * person's User row belongs to exactly one accountType by construction
 * (see @paon/domain `User`). A person who is somehow both a corporate
 * identity and an ordinary customer resolves as the corporate identity
 * only, the same accepted tradeoff already made between retailer_staff
 * and customer, extended two levels deeper — see `AccountType`'s own doc
 * comment.
 */
export function resolveAppSession(user: AuthUserLike): AppSession {
  const platformRole = asPlatformRole(user.app_metadata["platform_role"]);
  const retailerRole = asRetailerRole(user.app_metadata["retailer_role"]);
  const retailerId = asRetailerId(user.app_metadata["retailer_id"]);
  const customerId = asCustomerId(user.app_metadata["customer_id"]);
  const wearerId = asWearerId(user.app_metadata["wearer_id"]);
  const managerId = asManagerId(user.app_metadata["manager_id"]);

  const accountType: AccountType = platformRole
    ? "platform"
    : retailerId && retailerRole
      ? "retailer_staff"
      : managerId
        ? "corporate_manager"
        : wearerId
          ? "corporate_wearer"
          : "customer";

  return {
    userId: user.id as UserId,
    email: user.email ?? "",
    accountType,
    ...(platformRole ? { platformRole } : {}),
    ...(retailerId ? { retailerId } : {}),
    ...(retailerRole ? { retailerRole } : {}),
    ...(customerId ? { customerId } : {}),
    ...(wearerId ? { wearerId } : {}),
    ...(managerId ? { managerId } : {}),
  };
}
