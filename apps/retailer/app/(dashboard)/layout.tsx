import {
  RetailerRepository,
  WorkflowDefinitionRepository,
} from "@paon/database";
import {
  applyNavigationLabel,
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
        ...(!isWorkshopRole
          ? [
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

  return (
    <RetailerTheme theme={retailer.brandTheme}>
      <AppShell
        brand={retailer.displayName}
        product="PAON Retail"
        homeHref={homeHref}
        persona={PERSONA_LABELS[session.retailerRole]}
        email={session.email}
        navigation={navigation}
        mobileDock={mobileDock}
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
