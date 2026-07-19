/** Which of the three applications a User authenticates into. */
export type AccountType = "platform" | "retailer_staff" | "customer";

/** Roles within PAON Admin — platform staff, not tied to any retailer. */
export type PlatformRole =
  "platform_owner" | "platform_admin" | "support_agent" | "platform_analyst";

/** Roles within the Retailer Portal — scoped to a single retailer tenant. */
export type RetailerRole =
  | "owner"
  | "admin"
  | "manager"
  | "sales_associate"
  | "production_staff"
  | "read_only";

export const RETAILER_ROLE_HIERARCHY: readonly RetailerRole[] = [
  "read_only",
  "production_staff",
  "sales_associate",
  "manager",
  "admin",
  "owner",
];

export function retailerRoleAtLeast(
  role: RetailerRole,
  minimum: RetailerRole,
): boolean {
  return (
    RETAILER_ROLE_HIERARCHY.indexOf(role) >=
    RETAILER_ROLE_HIERARCHY.indexOf(minimum)
  );
}
