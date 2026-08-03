/**
 * PAON's deployable module kernel (R0.3 / ADR-070).
 *
 * Commercial features remain the fine-grained capability vocabulary from
 * ADR-040. Modules are the coherent product surfaces retailers turn on and
 * plans bundle: they carry dependencies, navigation, roles, authority and
 * background work as one contract instead of scattering tier-name checks
 * through applications.
 */

import type { RetailerRole } from "../identity/role";
import type {
  SourceAuthorityDomain,
  SourceAuthorityMode,
} from "../integrations/source-authority";

export const PLATFORM_MODULE_KEYS = [
  "platform_core",
  "relationship_intelligence",
  "wardrobe_styling",
  "commerce_growth",
  "garment_service_operations",
  "retail_operations",
  "enterprise_verticals",
  "network_ecosystem",
] as const;

export type PlatformModuleKey = (typeof PLATFORM_MODULE_KEYS)[number];

export const MODULE_LIFECYCLE_STATES = [
  "off",
  "preview",
  "active",
  "suspended",
] as const;

export type ModuleLifecycleState = (typeof MODULE_LIFECYCLE_STATES)[number];

export type ModuleEntitlementSource = "plan" | "add_on" | "override";

export interface ModuleNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly roles: readonly RetailerRole[];
}

export interface PlatformModuleDefinition {
  readonly key: PlatformModuleKey;
  readonly name: string;
  readonly familyOrder: number;
  readonly description: string;
  readonly dependencies: readonly PlatformModuleKey[];
  readonly navigation: readonly ModuleNavigationItem[];
  readonly authorityDomains: readonly SourceAuthorityDomain[];
  readonly jobs: readonly string[];
}

const ALL_RETAILER_ROLES: readonly RetailerRole[] = [
  "owner",
  "admin",
  "manager",
  "sales_associate",
  "production_staff",
  "workshop_manager",
  "worker",
  "read_only",
];

const CUSTOMER_FACING_ROLES: readonly RetailerRole[] = [
  "owner",
  "admin",
  "manager",
  "sales_associate",
  "read_only",
];

const ORDER_ROLES: readonly RetailerRole[] = [
  ...CUSTOMER_FACING_ROLES,
  "production_staff",
];

const MANAGER_ROLES: readonly RetailerRole[] = ["owner", "admin", "manager"];

export const PLATFORM_MODULES: readonly PlatformModuleDefinition[] = [
  {
    key: "platform_core",
    name: "Platform Core",
    familyOrder: 1,
    description:
      "Tenancy, identity, consent, provenance, audit, workflow, integration and module control.",
    dependencies: [],
    navigation: [
      { href: "/dashboard", label: "Brief", roles: ALL_RETAILER_ROLES },
      {
        href: "/notifications",
        label: "Updates",
        roles: ALL_RETAILER_ROLES,
      },
      { href: "/settings", label: "Settings", roles: MANAGER_ROLES },
      {
        href: "/settings/integrations",
        label: "Integrations",
        roles: MANAGER_ROLES,
      },
      {
        href: "/settings/workflows",
        label: "Workflows",
        roles: MANAGER_ROLES,
      },
    ],
    authorityDomains: [],
    jobs: ["notification_dispatch", "audit_retention"],
  },
  {
    key: "relationship_intelligence",
    name: "Client & Relationship Intelligence",
    familyOrder: 2,
    description:
      "House Memory, advisor preparation, appointments, conversations, promises and outcomes.",
    dependencies: ["platform_core"],
    navigation: [
      { href: "/customers", label: "Clients", roles: CUSTOMER_FACING_ROLES },
      {
        href: "/mission-control",
        label: "Mission Control",
        roles: CUSTOMER_FACING_ROLES,
      },
      {
        href: "/appointments",
        label: "Appointments",
        roles: CUSTOMER_FACING_ROLES,
      },
      { href: "/messages", label: "Messages", roles: CUSTOMER_FACING_ROLES },
    ],
    authorityDomains: ["customer", "appointment", "message"],
    jobs: ["advisor_brief_refresh", "promise_due_scan"],
  },
  {
    key: "wardrobe_styling",
    name: "Wardrobe & Styling Intelligence",
    familyOrder: 3,
    description:
      "Garment graph, visual wardrobe, fit evidence, composed looks, guided consultation and Morning Routine.",
    dependencies: ["platform_core", "relationship_intelligence"],
    navigation: [
      {
        href: "/settings/morning-routine",
        label: "Morning Routine",
        roles: MANAGER_ROLES,
      },
      { href: "/metadata", label: "Knowledge", roles: MANAGER_ROLES },
    ],
    authorityDomains: ["catalogue", "customer"],
    jobs: ["morning_routine_delivery", "wardrobe_freshness_scan"],
  },
  {
    key: "commerce_growth",
    name: "Commerce & Growth",
    familyOrder: 4,
    description:
      "Assisted selling, orders, private offers, campaigns, loyalty, referrals and measurable journeys.",
    dependencies: ["platform_core", "relationship_intelligence"],
    navigation: [
      { href: "/orders", label: "Orders", roles: ORDER_ROLES },
      { href: "/loyalty", label: "Loyalty", roles: MANAGER_ROLES },
      { href: "/events", label: "Events", roles: MANAGER_ROLES },
      { href: "/gifts", label: "Gifts", roles: MANAGER_ROLES },
      {
        href: "/settings/campaigns",
        label: "Campaigns",
        roles: MANAGER_ROLES,
      },
    ],
    authorityDomains: ["order", "payment", "catalogue"],
    jobs: ["campaign_activation", "loyalty_milestone_refresh"],
  },
  {
    key: "garment_service_operations",
    name: "Garment & Service Operations",
    familyOrder: 5,
    description:
      "Production, fitting, alterations, custody, delivery, care plans and partner fulfilment.",
    dependencies: ["platform_core", "relationship_intelligence"],
    navigation: [
      { href: "/alterations", label: "Alterations", roles: ALL_RETAILER_ROLES },
      {
        href: "/alterations/catalogue",
        label: "Service catalogue",
        roles: ["owner", "admin", "manager", "workshop_manager"],
      },
      { href: "/services", label: "Services", roles: CUSTOMER_FACING_ROLES },
      {
        href: "/alterations/workshops",
        label: "Workshop network",
        roles: ["owner", "admin", "manager", "workshop_manager"],
      },
      {
        href: "/service-partners",
        label: "Service partners",
        roles: ["owner", "admin", "manager", "workshop_manager"],
      },
      {
        href: "/supplier-intelligence",
        label: "Supplier intelligence",
        roles: ["owner", "admin", "manager", "workshop_manager"],
      },
    ],
    authorityDomains: ["production", "appointment", "order"],
    jobs: ["production_milestone_scan", "service_care_reminder"],
  },
  {
    key: "retail_operations",
    name: "Retail Operations",
    familyOrder: 6,
    description:
      "Catalogue, inventory, POS, staff work, scheduling, locations, analytics and reconciliation.",
    dependencies: ["platform_core"],
    navigation: [
      { href: "/inventory", label: "Stock", roles: CUSTOMER_FACING_ROLES },
      {
        href: "/inventory/risk",
        label: "Write-offs",
        roles: CUSTOMER_FACING_ROLES,
      },
      { href: "/pos", label: "Till", roles: CUSTOMER_FACING_ROLES },
      { href: "/products", label: "Products", roles: MANAGER_ROLES },
      { href: "/collections", label: "Collections", roles: MANAGER_ROLES },
      {
        href: "/capsule-drops",
        label: "Capsule drops",
        roles: MANAGER_ROLES,
      },
      { href: "/imports", label: "Imports", roles: MANAGER_ROLES },
      { href: "/migrations", label: "Migrations", roles: MANAGER_ROLES },
      { href: "/staff", label: "Team", roles: MANAGER_ROLES },
      {
        href: "/staff/recognition",
        label: "Recognition",
        roles: ALL_RETAILER_ROLES,
      },
      {
        href: "/staff/coverage",
        label: "Coverage",
        roles: ALL_RETAILER_ROLES,
      },
      {
        href: "/staff/announcements",
        label: "Announcements",
        roles: ALL_RETAILER_ROLES,
      },
      {
        href: "/staff/learning",
        label: "Learning",
        roles: ALL_RETAILER_ROLES,
      },
      {
        href: "/staff/service-recovery",
        label: "Service recovery",
        roles: ALL_RETAILER_ROLES,
      },
      {
        href: "/staff/support",
        label: "Support",
        roles: ALL_RETAILER_ROLES,
      },
      { href: "/analytics", label: "Performance", roles: MANAGER_ROLES },
    ],
    authorityDomains: ["catalogue", "inventory", "order", "payment", "payroll"],
    jobs: ["inventory_drift_monitor", "integration_reconciliation"],
  },
  {
    key: "enterprise_verticals",
    name: "Enterprise & Vertical Solutions",
    familyOrder: 7,
    description:
      "Corporate wardrobes, wedding parties, multi-location, preferred tailoring and consultancy.",
    dependencies: [
      "platform_core",
      "relationship_intelligence",
      "garment_service_operations",
    ],
    navigation: [
      {
        href: "/wedding-parties",
        label: "Wedding parties",
        roles: CUSTOMER_FACING_ROLES,
      },
      {
        href: "/corporate",
        label: "Corporate",
        roles: CUSTOMER_FACING_ROLES,
      },
    ],
    authorityDomains: ["customer", "order", "production", "appointment"],
    jobs: ["wedding_readiness_scan", "corporate_entitlement_monitor"],
  },
  {
    key: "network_ecosystem",
    name: "Network & Ecosystem",
    familyOrder: 8,
    description:
      "Partner procurement, publisher participation, curated commerce, attribution and multi-party experiences.",
    dependencies: [
      "platform_core",
      "commerce_growth",
      "garment_service_operations",
    ],
    navigation: [],
    authorityDomains: ["catalogue", "order", "payment", "production"],
    jobs: ["partner_attribution_reconciliation", "audience_release_expiry"],
  },
];

export const PLATFORM_MODULE_BY_KEY: Readonly<
  Record<PlatformModuleKey, PlatformModuleDefinition>
> = Object.fromEntries(
  PLATFORM_MODULES.map((module) => [module.key, module]),
) as Readonly<Record<PlatformModuleKey, PlatformModuleDefinition>>;

export interface RetailerModuleConfiguration {
  readonly moduleKey: PlatformModuleKey;
  readonly state: ModuleLifecycleState;
  readonly authorityMode: SourceAuthorityMode;
  readonly source: ModuleEntitlementSource;
}

export interface ModulePlanContract {
  readonly key: string;
  readonly name: string;
  readonly moduleKeys: readonly PlatformModuleKey[];
}

export interface ModuleDependencyConflict {
  readonly moduleKey: PlatformModuleKey;
  readonly dependencyKey: PlatformModuleKey;
  readonly reason: "missing" | "not_active";
}

function configurationMap(
  configurations: readonly RetailerModuleConfiguration[],
): ReadonlyMap<PlatformModuleKey, RetailerModuleConfiguration> {
  return new Map(configurations.map((entry) => [entry.moduleKey, entry]));
}

/** Active modules require active dependencies; previews accept preview deps. */
export function validateModuleDependencies(
  configurations: readonly RetailerModuleConfiguration[],
): readonly ModuleDependencyConflict[] {
  const configured = configurationMap(configurations);
  const conflicts: ModuleDependencyConflict[] = [];

  for (const entry of configurations) {
    if (entry.state !== "active" && entry.state !== "preview") continue;
    for (const dependencyKey of PLATFORM_MODULE_BY_KEY[entry.moduleKey]
      .dependencies) {
      const dependency = configured.get(dependencyKey);
      if (!dependency) {
        conflicts.push({
          moduleKey: entry.moduleKey,
          dependencyKey,
          reason: "missing",
        });
        continue;
      }
      const allowedStates =
        entry.state === "active" ? ["active"] : ["active", "preview"];
      if (!allowedStates.includes(dependency.state)) {
        conflicts.push({
          moduleKey: entry.moduleKey,
          dependencyKey,
          reason: "not_active",
        });
      }
    }
  }
  return conflicts;
}

export function validateModulePlan(
  contract: ModulePlanContract,
): readonly ModuleDependencyConflict[] {
  return validateModuleDependencies(
    contract.moduleKeys.map((moduleKey) => ({
      moduleKey,
      state: "active",
      authorityMode: "paon",
      source: "plan",
    })),
  );
}

export function projectModuleNavigation(args: {
  readonly configurations: readonly RetailerModuleConfiguration[];
  readonly role: RetailerRole;
}): readonly (ModuleNavigationItem & {
  readonly moduleKey: PlatformModuleKey;
  readonly preview: boolean;
})[] {
  const configured = configurationMap(args.configurations);
  return PLATFORM_MODULES.flatMap((module) => {
    const state = configured.get(module.key)?.state ?? "off";
    if (state !== "active" && state !== "preview") return [];
    return module.navigation
      .filter((item) => item.roles.includes(args.role))
      .map((item) => ({
        ...item,
        moduleKey: module.key,
        preview: state === "preview",
      }));
  });
}

/** Preview, suspended and off modules never dispatch production jobs. */
export function moduleMayRunJob(
  configuration: RetailerModuleConfiguration | undefined,
  jobKey: string,
): boolean {
  if (!configuration || configuration.state !== "active") return false;
  return PLATFORM_MODULE_BY_KEY[configuration.moduleKey].jobs.includes(jobKey);
}

export type ModuleAccessMode = "read" | "mutate";

/**
 * Preview may render real read-only data, but it can never mutate it. This is
 * deliberately separate from navigation projection: hiding a link does not
 * stop a stale tab or a direct Server Action request.
 */
export function moduleAllowsAccess(
  configuration: RetailerModuleConfiguration | undefined,
  mode: ModuleAccessMode,
): boolean {
  if (!configuration) return false;
  if (mode === "mutate") return configuration.state === "active";
  return configuration.state === "active" || configuration.state === "preview";
}
