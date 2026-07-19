import { type RetailerRole, retailerRoleAtLeast } from "@paon/domain";

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
