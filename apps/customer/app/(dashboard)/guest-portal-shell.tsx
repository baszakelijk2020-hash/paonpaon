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
      label: "Preview",
      items: [
        {
          href: fromQuery
            ? `/dashboard?from=${encodeURIComponent(fromQuery)}`
            : "/dashboard",
          label: "Your world",
          description: "What is happening now",
        },
        {
          href: signIn("/wishlist"),
          label: "Saved pieces",
          description: "Sign in to open",
        },
        {
          href: signIn("/loyalty"),
          label: "Recognition",
          description: "Sign in to open",
        },
      ],
    },
    {
      label: "In progress",
      items: [
        {
          href: signIn("/orders"),
          label: "Orders",
          description: "Sign in to open",
        },
        {
          href: signIn("/appointments"),
          label: "Appointments",
          description: "Sign in to open",
        },
        {
          href: signIn("/wedding-parties"),
          label: "Wedding parties",
          description: "Sign in to open",
        },
      ],
    },
    {
      label: "Account",
      items: [
        {
          href: signIn("/account"),
          label: "Preferences",
          description: "Sign in to open",
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
      product="Private client"
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
        {
          href: `/login?redirectTo=${encodeURIComponent("/account")}`,
          label: "Account",
        },
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
