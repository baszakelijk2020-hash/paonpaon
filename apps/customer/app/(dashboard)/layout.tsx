import { AppShell, type AppShellNavGroup } from "@paon/ui/components/AppShell";
import { Button } from "@paon/ui/components/Button";
import Link from "next/link";

import { signOut } from "./actions";
import { GuestPortalPreview } from "./guest-portal-preview";

import { getSession } from "@/lib/session";

const navigation: AppShellNavGroup[] = [
  {
    label: "For you",
    items: [
      {
        href: "/dashboard",
        label: "Your world",
        description: "What is happening now",
      },
      {
        href: "/wishlist",
        label: "Saved pieces",
        description: "Your considered selection",
      },
      {
        href: "/loyalty",
        label: "Recognition",
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
        label: "Your advisors",
        description: "Private conversations",
      },
      {
        href: "/events",
        label: "Invitations",
        description: "Private previews and events",
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
    label: "Profile",
    items: [
      {
        href: "/account",
        label: "Preferences",
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
      <AppShell
        brand="PAON"
        product="Private client"
        homeHref="/dashboard"
        persona="Preview"
        email="Wander first — sign in when you wish"
        navigation={navigation}
        mobileDock={[
          { href: "/dashboard", label: "Home" },
          { href: "/login?redirectTo=%2Fdashboard", label: "Sign in" },
          { href: "/r/maison-dubois", label: "Store" },
          { href: "/account", label: "Account" },
        ]}
        signOutControl={
          <Link
            href="/login?redirectTo=%2Fdashboard"
            className="inline-flex min-h-9 items-center px-3 text-sm underline underline-offset-4"
          >
            Sign in
          </Link>
        }
      >
        <GuestPortalPreview />
      </AppShell>
    );
  }

  return (
    <AppShell
      brand="PAON"
      product="Private client"
      homeHref="/dashboard"
      persona="Private client"
      email={session.email}
      navigation={navigation}
      mobileDock={[
        { href: "/orders", label: "Orders" },
        { href: "/appointments", label: "Appointments" },
        { href: "/messages", label: "Messages" },
        { href: "/account", label: "Account" },
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
