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
  | "workshop_manager"
  | "worker"
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
  if (role === "workshop_manager" || role === "worker") {
    return role === minimum;
  }
  if (minimum === "workshop_manager" || minimum === "worker") {
    return false;
  }
  return (
    RETAILER_ROLE_HIERARCHY.indexOf(role) >=
    RETAILER_ROLE_HIERARCHY.indexOf(minimum)
  );
}

export type AlterationsPermission =
  | "configure"
  | "approve_pricing"
  | "intake"
  | "oversight"
  | "manage_assigned_workshop"
  | "work_assigned_tasks";

const ALTERATIONS_PERMISSIONS: Record<
  RetailerRole,
  readonly AlterationsPermission[]
> = {
  owner: ["configure", "approve_pricing", "intake", "oversight"],
  admin: ["configure", "approve_pricing", "intake", "oversight"],
  manager: ["configure", "approve_pricing", "intake", "oversight"],
  sales_associate: ["intake"],
  production_staff: ["oversight"],
  workshop_manager: ["manage_assigned_workshop"],
  worker: ["work_assigned_tasks"],
  read_only: [],
};

export function retailerRoleHasAlterationsPermission(
  role: RetailerRole,
  permission: AlterationsPermission,
): boolean {
  return ALTERATIONS_PERMISSIONS[role].includes(permission);
}
