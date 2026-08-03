import {
  PlatformModuleRepository,
  RetailerRepository,
  WorkflowDefinitionRepository,
} from "@paon/database";
import {
  applyNavigationLabel,
  projectModuleNavigation,
  RETAILER_ROLE_LABELS,
  retailerRoleAtLeast,
  retailerRoleHasAlterationsPermission,
} from "@paon/domain";
import { AppShell, type AppShellNavGroup } from "@paon/ui/components/AppShell";
import { Button } from "@paon/ui/components/Button";
import { RetailerTheme } from "@paon/ui/components/RetailerTheme";
import { notFound } from "next/navigation";

import { signOut } from "./actions";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { OfflineBanner } from "./offline-banner";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const PERSONA_LABELS = RETAILER_ROLE_LABELS;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findById(
    session.retailerId,
  );
  if (!retailer) notFound();
  const familiarity = await new WorkflowDefinitionRepository(
    supabase,
  ).getRetailerPreset(session.retailerId);
  const moduleConfigurations = await new PlatformModuleRepository(
    supabase,
  ).resolveRetailer(session.retailerId);
  const projectedModuleNavigation = projectModuleNavigation({
    configurations: moduleConfigurations,
    role: session.retailerRole,
  });
  const moduleNavigationByHref = new Map(
    projectedModuleNavigation.map((item) => [item.href, item]),
  );
  const canManageRetailer = retailerRoleAtLeast(session.retailerRole, "admin");
  const canManageCustomers = retailerRoleAtLeast(
    session.retailerRole,
    "sales_associate",
  );
  const canManageCatalog = retailerRoleAtLeast(session.retailerRole, "manager");
  const canConfigureAlterations = retailerRoleHasAlterationsPermission(
    session.retailerRole,
    "configure",
  );
  const canManageWorkshop = retailerRoleHasAlterationsPermission(
    session.retailerRole,
    "manage_assigned_workshop",
  );
  const isWorkshopRole = ["workshop_manager", "worker"].includes(
    session.retailerRole,
  );
  const homeHref = "/dashboard";

  const navigation: AppShellNavGroup[] = [
    {
      label: "Today",
      items: [
        {
          href: "/dashboard",
          label: "Brief",
          description: "Attention, appointments and pace",
        },
        // PHASE 11.2 / WFM-104. Deliberately in the unconditional group:
        // recognition only managers (or only shop-floor roles) can see is
        // not recognition, which is why its RLS read policy is open to
        // every retailer role too.
        {
          href: "/staff/recognition",
          label: "Recognition",
          description: "Extra-mile acts and coaching",
        },
        // PHASE 11.3 / WFM-105. Also unconditional: a published coverage
        // requirement people cannot see is not a plan. The publish and
        // observe actions on the page are manager-gated in RLS, so the nav
        // entry being open costs nothing.
        {
          href: "/staff/coverage",
          label: "Coverage",
          description: "What the day needs, and where it is short",
        },
        // PHASE 11.4 / WFM-107. Unconditional for the same reason as
        // Recognition and Coverage above: RLS already scopes each row (a
        // budget request is requester-or-manager only; an unapproved
        // contribution is author-or-moderator only), so the nav entry being
        // open to every role costs nothing and a hidden entry was the actual
        // defect — this route existed and had a passing browser proof with
        // no link anywhere in the app that could reach it.
        {
          href: "/staff/announcements",
          label: "Announcements",
          description: "Team updates and read receipts",
        },
        {
          href: "/staff/learning",
          label: "Learning",
          description: "Share what you know; moderated before it's shared",
        },
        {
          href: "/staff/service-recovery",
          label: "Service recovery",
          description: "Request and approve an authorised spend",
        },
        {
          href: "/staff/support",
          label: "Support",
          description: "Confidential help resources",
        },
        ...(!isWorkshopRole
          ? [
              {
                href: "/mission-control",
                label: "Mission Control",
                description: "Today, time-blocked — appointments and picks",
              },
              {
                href: "/appointments",
                label: "Appointments",
                description: "Calendar, fittings and follow-up",
              },
              {
                href: "/orders",
                label: "Orders",
                description: "Promises through fulfilment",
              },
              // PHASE 13.1 / INV-101. Not workshop-facing: the shop floor and
              // stockroom are where stock is received, held and counted.
              {
                href: "/inventory",
                label: "Stock",
                description: "What is on hand, and every movement behind it",
              },
              // PHASE 13.2 / INV-104, INV-105. Next to Stock because it is
              // the control over it: nothing valuable leaves without two
              // people, and a reader sweep lands here rather than in a balance.
              {
                href: "/inventory/risk",
                label: "Write-offs",
                description:
                  "Approvals waiting, and what a sweep disagreed with",
              },
              // PHASE 13.3 / POS-101. Sits next to Stock deliberately: the
              // till writes to the same ledger, so they are one subject.
              {
                href: "/pos",
                label: "Till",
                description: "Sell, take payment, and handle a return",
              },
              {
                href: "/messages",
                label: "Messages",
                description: "Client questions and requests",
              },
              {
                href: "/notifications",
                label: "Updates",
                description: "Activity across the atelier",
              },
            ]
          : [
              {
                href: "/notifications",
                label: "Updates",
                description: "Activity across the atelier",
              },
            ]),
      ],
    },
    {
      label: isWorkshopRole
        ? "Workshop floor"
        : (familiarity.navigation.groupLabels.fitting_room ?? "Fitting room"),
      items: [
        {
          href: "/alterations",
          label: isWorkshopRole
            ? "Work queue"
            : applyNavigationLabel(
                "/alterations",
                "Alterations",
                familiarity.navigation,
              ),
          description: isWorkshopRole
            ? "Assigned garments and due dates"
            : "Fitting-to-workshop progress",
        },
        ...(canConfigureAlterations || canManageWorkshop
          ? [
              {
                href: "/alterations/catalogue",
                label: canManageWorkshop
                  ? "Workshop pricing"
                  : applyNavigationLabel(
                      "/alterations/catalogue",
                      "Service catalogue",
                      familiarity.navigation,
                    ),
                description: "Operations and agreed costs",
              },
            ]
          : []),
        ...(canConfigureAlterations
          ? [
              {
                href: "/alterations/workshops",
                label: applyNavigationLabel(
                  "/alterations/workshops",
                  "Workshop network",
                  familiarity.navigation,
                ),
                description: "Partners, assignments and access",
              },
              {
                href: "/service-partners",
                label: "Service partners",
                description: "Dry cleaning, repair — booking and invoices",
              },
              {
                href: "/supplier-intelligence",
                label: "Supplier intelligence",
                description: "Material facts, exceptions and complaint cases",
              },
              {
                href: "/production",
                label: "Production",
                description: "Serialized pieces, stages and work tickets",
              },
            ]
          : []),
      ],
    },
    ...(!isWorkshopRole && canManageCustomers
      ? [
          {
            label: "Relationships",
            items: [
              {
                href: "/customers",
                label: "Clients",
                description: "Profiles, history and next action",
              },
              {
                href: "/wedding-parties",
                label: "Wedding parties",
                description: "Group fittings and readiness",
              },
              ...(canManageCatalog
                ? [
                    {
                      href: "/loyalty",
                      label: "Loyalty",
                      description: "Recognition and rewards",
                    },
                    {
                      href: "/services",
                      label: "Services",
                      description: "Preferred Tailoring and HighMaintenance",
                    },
                    {
                      href: "/events",
                      label: "Events",
                      description: "Previews and RSVPs",
                    },
                    {
                      href: "/corporate",
                      label: "Corporate",
                      description: "Métier accounts, wearers and entitlements",
                    },
                  ]
                : [
                    {
                      href: "/services",
                      label: "Services",
                      description: "Preferred Tailoring and HighMaintenance",
                    },
                  ]),
            ],
          },
        ]
      : []),
    ...(canManageCatalog
      ? [
          {
            label: "Merchandise",
            items: [
              {
                href: "/products",
                label: "Products",
                description: "Imagery and availability",
              },
              {
                href: "/collections",
                label: "Collections",
                description: "Group products for storefront",
              },
              {
                href: "/capsule-drops",
                label: "Capsule drops",
                description: "This week's curated small set",
              },
              {
                href: "/metadata",
                label: "Metadata",
                description: "Review assignments and overrides",
              },
              {
                href: "/imports",
                label: "Imports",
                description: "Supplier preview without publishing",
              },
              {
                href: "/migrations",
                label: "Migrations",
                description: "Staged-file dry-run and publish",
              },
              {
                href: "/settings/morning-routine",
                label: "MorningRoutine",
                description: "Delivery pause and eligible products",
              },
              {
                href: "/settings/campaigns",
                label: "Campaigns",
                description: "Private offers and seven-day challenges",
              },
              {
                href: "/analytics",
                label: "Performance",
                description: "Commercial and service signals",
              },
            ],
          },
        ]
      : []),
    ...(canManageRetailer
      ? [
          {
            label: "Atelier",
            items: [
              {
                href: "/staff",
                label: "Team",
                description: "People, roles and invitations",
              },
              {
                href: "/settings",
                label: "Settings",
                description: "Identity, billing and payments",
              },
            ],
          },
        ]
      : []),
  ];

  const entitledNavigation: AppShellNavGroup[] = navigation
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => moduleNavigationByHref.has(item.href))
        .map((item) => ({
          ...item,
          label: moduleNavigationByHref.get(item.href)?.preview
            ? `${item.label} · Preview`
            : item.label,
        })),
    }))
    .filter((group) => group.items.length > 0);

  const mobileDock = isWorkshopRole
    ? [
        { href: "/dashboard", label: "Brief" },
        { href: "/alterations", label: "Queue" },
        { href: "/notifications", label: "Updates" },
        ...(canConfigureAlterations || canManageWorkshop
          ? [{ href: "/alterations/catalogue", label: "Pricing" }]
          : []),
      ]
    : [
        { href: "/dashboard", label: "Brief" },
        { href: "/appointments", label: "Appointments" },
        ...(canManageCustomers
          ? [{ href: "/customers", label: "Clients" }]
          : [{ href: "/orders", label: "Orders" }]),
        { href: "/messages", label: "Messages" },
      ];
  const entitledMobileDock = mobileDock.filter((item) =>
    moduleNavigationByHref.has(item.href),
  );

  return (
    <RetailerTheme theme={retailer.brandTheme}>
      <AppShell
        brand={retailer.displayName}
        product="PAON Retail"
        homeHref={homeHref}
        persona={PERSONA_LABELS[session.retailerRole]}
        email={session.email}
        navigation={entitledNavigation}
        mobileDock={entitledMobileDock}
        signOutControl={
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        }
      >
        <OfflineBanner />
        {children}
        <KeyboardShortcuts
          {...(!isWorkshopRole && canManageCustomers
            ? { newClientHref: "/customers/new" }
            : {})}
        />
      </AppShell>
    </RetailerTheme>
  );
}
