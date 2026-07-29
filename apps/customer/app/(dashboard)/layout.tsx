import { AppShell, type AppShellNavGroup } from "@paon/ui/components/AppShell";
import { Button } from "@paon/ui/components/Button";
import { Suspense } from "react";

import { signOut } from "./actions";
import { GuestPortalShell } from "./guest-portal-shell";

import { getSession } from "@/lib/session";

const navigation: AppShellNavGroup[] = [
  {
    label: "For you",
    items: [
      {
        href: "/dashboard",
        label: "Home",
        description: "What is happening now",
      },
      {
        href: "/wishlist",
        label: "Saved",
        description: "Your considered selection",
      },
      {
        href: "/loyalty",
        label: "Loyalty",
        description: "Status, points and rewards",
      },
    ],
  },
  {
    label: "In progress",
    items: [
      {
        href: "/orders",
        label: "Orders",
        description: "Purchases and delivery",
      },
      {
        href: "/appointments",
        label: "Appointments",
        description: "Fittings and consultations",
      },
      {
        href: "/alterations",
        label: "Alterations",
        description: "Garment progress and pickup",
      },
    ],
  },
  {
    label: "Together",
    items: [
      {
        href: "/messages",
        label: "Messages",
        description: "Private conversations",
      },
      {
        href: "/events",
        label: "Events",
        description: "Private previews and invitations",
      },
      {
        href: "/wedding-parties",
        label: "Wedding parties",
        description: "Group fittings and plans",
      },
      {
        href: "/notifications",
        label: "Updates",
        description: "Everything worth knowing",
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        href: "/account",
        label: "Settings",
        description: "Contact, delivery and privacy",
      },
    ],
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const isCustomer = session?.accountType === "customer";

  if (!isCustomer) {
    return (
      <Suspense fallback={null}>
        <GuestPortalShell />
      </Suspense>
    );
  }

  return (
    <AppShell
      brand="PAON"
      product="Client"
      homeHref="/dashboard"
      persona="Private client"
      email={session.email}
      navigation={navigation}
      mobileDock={[
        { href: "/dashboard", label: "Home" },
        { href: "/appointments", label: "Appointments" },
        { href: "/messages", label: "Messages" },
        { href: "/orders", label: "Orders" },
      ]}
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
  );
}
