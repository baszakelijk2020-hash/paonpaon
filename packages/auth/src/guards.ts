import {
  type AlterationsPermission,
  type RetailerRole,
  retailerRoleAtLeast,
  retailerRoleHasAlterationsPermission,
} from "@paon/domain";

import type { AppSession } from "./session";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function requireAlterationsPermission(
  role: RetailerRole | undefined,
  permission: AlterationsPermission,
): asserts role is RetailerRole {
  if (!role) {
    throw new UnauthorizedError();
  }
  if (!retailerRoleHasAlterationsPermission(role, permission)) {
    throw new ForbiddenError(`Requires alterations permission "${permission}"`);
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Throws unless `role` meets `minimum`. Application-layer defense in
 * depth only — Postgres RLS is the actual authorization boundary.
 * Never trust this check alone to guard a mutation. See
 * ARCHITECTURE.md "Authorization Model".
 */
export function requireRetailerRole(
  role: RetailerRole | undefined,
  minimum: RetailerRole,
): asserts role is RetailerRole {
  if (!role) {
    throw new UnauthorizedError();
  }
  if (!retailerRoleAtLeast(role, minimum)) {
    throw new ForbiddenError(`Requires at least "${minimum}" role`);
  }
}

/** Throws unless the session belongs to a PAON Admin (platform) user. */
export function requirePlatformSession(
  session: AppSession | null,
): asserts session is AppSession & {
  platformRole: NonNullable<AppSession["platformRole"]>;
} {
  if (!session) {
    throw new UnauthorizedError();
  }
  if (session.accountType !== "platform" || !session.platformRole) {
    throw new ForbiddenError("Requires a PAON Admin session");
  }
}

/**
 * Throws unless the session is platform staff with one of the roles
 * that may manage other platform staff and retailer tenants directly.
 */
export function requirePlatformOperator(session: AppSession | null): void {
  requirePlatformSession(session);
  if (!["platform_owner", "platform_admin"].includes(session.platformRole)) {
    throw new ForbiddenError('Requires "platform_owner" or "platform_admin"');
  }
}

/** Throws unless the session belongs to a Retailer Portal (staff) user for `retailerId`. */
export function requireRetailerSession(
  session: AppSession | null,
): asserts session is AppSession & {
  retailerId: NonNullable<AppSession["retailerId"]>;
  retailerRole: NonNullable<AppSession["retailerRole"]>;
} {
  if (!session) {
    throw new UnauthorizedError();
  }
  if (
    session.accountType !== "retailer_staff" ||
    !session.retailerId ||
    !session.retailerRole
  ) {
    throw new ForbiddenError("Requires a Retailer Portal session");
  }
}

/**
 * Throws unless the session belongs to a Customer Portal user. Unlike
 * `requireRetailerSession`/`requirePlatformSession`, there is no
 * further claim to assert here — a customer session is valid the
 * moment it's authenticated, even with zero linked `Customer` rows
 * (see docs/DECISIONS.md ADR-013); which retailer relationships exist
 * is resolved per-request from `CustomerRepository`, never from a
 * session-wide claim.
 */
export function requireCustomerSession(
  session: AppSession | null,
): asserts session is AppSession & { accountType: "customer" } {
  if (!session) {
    throw new UnauthorizedError();
  }
  if (session.accountType !== "customer") {
    throw new ForbiddenError("Requires a Customer Portal session");
  }
}

/** Throws unless the session belongs to a corporate wearer's Employee
 * Portal login (PHASE 18.5) — never a retailer staff or ordinary
 * customer session, even one signed in to the same customer app. */
export function requireWearerSession(
  session: AppSession | null,
): asserts session is AppSession & {
  accountType: "corporate_wearer";
  wearerId: NonNullable<AppSession["wearerId"]>;
} {
  if (!session) {
    throw new UnauthorizedError();
  }
  if (session.accountType !== "corporate_wearer" || !session.wearerId) {
    throw new ForbiddenError("Requires an Employee Portal session");
  }
}

/** Throws unless the session belongs to a corporate account's own manager
 * login (PHASE 14.1) — never retailer staff, a wearer, or an ordinary
 * customer session, even one signed in to the same customer app. A
 * manager's scope is one `corporate_accounts` row; which account is
 * resolved per-request from `CorporateRepository`/RLS, never trusted from
 * this claim alone (same posture as `requireCustomerSession`). */
export function requireCorporateManagerSession(
  session: AppSession | null,
): asserts session is AppSession & {
  accountType: "corporate_manager";
  managerId: NonNullable<AppSession["managerId"]>;
} {
  if (!session) {
    throw new UnauthorizedError();
  }
  if (session.accountType !== "corporate_manager" || !session.managerId) {
    throw new ForbiddenError("Requires an Employee Portal manager session");
  }
}
