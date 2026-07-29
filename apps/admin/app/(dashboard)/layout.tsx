import type { AppShellNavGroup } from "@paon/ui/components/AppShell";
import { AppShell } from "@paon/ui/components/AppShell";
import { Button } from "@paon/ui/components/Button";

import { signOut } from "./actions";

import { requireSession } from "@/lib/session";

const navigation: AppShellNavGroup[] = [
  {
    label: "Operate",
    items: [
      {
        href: "/retailers",
        label: "Retailer network",
        description: "Onboarding, health and access",
      },
      {
        href: "/billing",
        label: "Commercials",
        description: "Plans and subscription status",
      },
      {
        href: "/prospects",
        label: "Demo Studio",
        description: "Prospects and personalized environments",
      },
      {
        href: "/inquiries",
        label: "Inquiries",
        description: "Demo requests and consultations",
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        href: "/analytics",
        label: "Platform pulse",
        description: "Adoption and operating signals",
      },
      {
        href: "/ai-monitoring",
        label: "AI studio",
        description: "Generation quality and failures",
      },
    ],
  },
  {
    label: "Environment",
    items: [
      {
        href: "/demo-mode",
        label: "Demo atelier",
        description: "Personas and showcase data",
      },
    ],
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const persona =
    session.platformRole === "platform_owner"
      ? "Platform owner"
      : "Platform operator";

  return (
    <AppShell
      brand="PAON"
      product="Platform"
      homeHref="/retailers"
      persona={persona}
      email={session.email}
      navigation={navigation}
      mobileDock={[
        { href: "/prospects", label: "Prospects" },
        { href: "/inquiries", label: "Inquiries" },
        { href: "/retailers", label: "Retailers" },
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
