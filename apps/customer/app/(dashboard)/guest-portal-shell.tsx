"use client";

import { AppShell } from "@paon/ui/components/AppShell";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { GuestPortalPreview } from "./guest-portal-preview";

function storeHrefFrom(from: string | null): string {
  if (from && /^\/r\/[a-z0-9-]+$/i.test(from)) return from;
  return "/r/maison-dubois";
}

function guestNav(fromQuery: string) {
  const signIn = (path: string) =>
    `/login?redirectTo=${encodeURIComponent(path)}${fromQuery ? `&from=${encodeURIComponent(fromQuery)}` : ""}`;

  return [
    {
      label: "Start here",
      items: [
        {
          href: fromQuery
            ? `/dashboard?from=${encodeURIComponent(fromQuery)}`
            : "/dashboard",
          label: "Home",
          description: "Private-client preview",
        },
        {
          href: signIn("/dashboard"),
          label: "Sign in",
          description: "Open your full client space",
        },
        {
          href: fromQuery || "/r/maison-dubois",
          label: "Continue shopping",
          description: "Return to the storefront",
        },
      ],
    },
  ];
}

export function GuestPortalShell() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const storeHref = storeHrefFrom(from);
  const fromQuery = from && /^\/r\/[a-z0-9-]+$/i.test(from) ? from : "";
  const signInDashboard = `/login?redirectTo=${encodeURIComponent("/dashboard")}`;

  return (
    <AppShell
      brand="PAON"
      product="Client"
      homeHref={
        fromQuery
          ? `/dashboard?from=${encodeURIComponent(fromQuery)}`
          : "/dashboard"
      }
      persona="Preview"
      email="Wander first — sign in when you wish"
      navigation={guestNav(fromQuery)}
      mobileDock={[
        {
          href: fromQuery
            ? `/dashboard?from=${encodeURIComponent(fromQuery)}`
            : "/dashboard",
          label: "Home",
        },
        { href: signInDashboard, label: "Sign in" },
        { href: storeHref, label: "Store" },
      ]}
      signOutControl={
        <Link
          href={signInDashboard}
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
