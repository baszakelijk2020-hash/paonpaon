import { type RetailerRole, retailerRoleAtLeast } from "@paon/domain";

import type { AppSession } from "./session";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
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
