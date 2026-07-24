import { RetailerRepository } from "@paon/database";
import {
  retailerRoleAtLeast,
  retailerRoleHasAlterationsPermission,
} from "@paon/domain";
import { AppShell, type AppShellNavGroup } from "@paon/ui/components/AppShell";
import { Button } from "@paon/ui/components/Button";
import { RetailerTheme } from "@paon/ui/components/RetailerTheme";
import { notFound } from "next/navigation";

import { signOut } from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const PERSONA_LABELS = {
  owner: "Retailer owner",
  admin: "Retailer administrator",
  manager: "Retailer manager",
  sales_associate: "Sales advisor",
  production_staff: "Production specialist",
  workshop_manager: "Workshop manager",
  worker: "Alteration specialist",
  read_only: "Read-only observer",
} as const;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const retailer = await new RetailerRepository(
    await getSupabaseServerClient(),
  ).findById(session.retailerId);
  if (!retailer) notFound();
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
  const homeHref = isWorkshopRole ? "/alterations" : "/dashboard";

  const navigation: AppShellNavGroup[] = [
    ...(!isWorkshopRole
      ? [
          {
            label: "Today",
            items: [
              {
                href: "/dashboard",
                label: "Daily brief",
                description: "Attention, appointments and pace",
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
              {
                href: "/messages",
                label: "Conversations",
                description: "Client questions and requests",
              },
              {
                href: "/notifications",
                label: "Updates",
                description: "Activity across the atelier",
              },
            ],
          },
        ]
      : []),
    {
      label: isWorkshopRole ? "Workshop floor" : "Fitting room",
      items: [
        {
          href: "/alterations",
          label: isWorkshopRole ? "Work queue" : "Alterations",
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
                  : "Service catalogue",
                description: "Operations and agreed costs",
              },
            ]
          : []),
        ...(canConfigureAlterations
          ? [
              {
                href: "/alterations/workshops",
                label: "Workshop network",
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
                label: "Client book",
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
                      href: "/events",
                      label: "Events",
                      description: "Invitations and attendance",
                    },
                  ]
                : []),
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
                label: "Catalogue",
                description: "Products, imagery and availability",
              },
              {
                href: "/collections",
                label: "Collections",
                description: "Editorial product stories",
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

  return (
    <RetailerTheme theme={retailer.brandTheme}>
      <AppShell
        brand={retailer.displayName}
        product="PAON Retail"
        homeHref={homeHref}
        persona={PERSONA_LABELS[session.retailerRole]}
        email={session.email}
        navigation={navigation}
        signOutControl={
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        }
      >
        {children}
      </AppShell>
    </RetailerTheme>
  );
}
