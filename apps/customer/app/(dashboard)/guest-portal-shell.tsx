"use client";

import { AppShell, type AppShellNavGroup } from "@paon/ui/components/AppShell";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { GuestPortalPreview } from "./guest-portal-preview";

function storeHrefFrom(from: string | null): string {
  if (from && /^\/r\/[a-z0-9-]+$/i.test(from)) return from;
  return "/r/maison-dubois";
}

export function GuestPortalShell({
  navigation,
}: {
  navigation: AppShellNavGroup[];
}) {
  const searchParams = useSearchParams();
  const storeHref = storeHrefFrom(searchParams.get("from"));

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
        { href: storeHref, label: "Store" },
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
      <GuestPortalPreview storeHref={storeHref} />
    </AppShell>
  );
}
