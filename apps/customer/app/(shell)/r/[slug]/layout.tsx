import {
  CustomerRepository,
  WardrobeRepository,
  WeddingPartyRepository,
} from "@paon/database";
import { RetailerTheme } from "@paon/ui/components/RetailerTheme";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { getProactiveNudge } from "./proactive-nudge-actions";
import { ProactiveNudgeWidget } from "./proactive-nudge-widget";
import { getStorefrontRetailer } from "./storefront-context";
import { TableServiceWidget } from "./table-service-widget";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Every `/r/[slug]` route needs the retailer resolved to render at all
 * (see `products/page.tsx`), so re-resolving it here to mount
 * TableService doesn't add a query child pages don't already pay for —
 * it does mean the lookup happens twice per request (here and again in
 * the page), acceptable until there's a shared request-level cache.
 */
export default async function StorefrontLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [supabase, session] = await Promise.all([
    getSupabaseServerClient(),
    getSession(),
  ]);
  const retailer = await getStorefrontRetailer(slug);
  if (!retailer || retailer.status !== "active") {
    notFound();
  }

  let weddingParties: { id: string; label: string }[] = [];
  let garments: { id: string; label: string }[] = [];
  let nudge: Awaited<ReturnType<typeof getProactiveNudge>> = null;
  if (session?.accountType === "customer") {
    const customers = await new CustomerRepository(supabase).findByUserId(
      session.userId,
    );
    const customer = customers.find((row) => row.retailerId === retailer.id);
    if (customer) {
      const [parties, wardrobeItems, nudgeResult] = await Promise.all([
        new WeddingPartyRepository(supabase).findByCustomer(customer.id),
        new WardrobeRepository(supabase).findByCustomer(customer.id),
        getProactiveNudge(retailer.id),
      ]);
      weddingParties = parties.map((party) => ({
        id: party.id,
        label: party.venueName ?? "My wedding party",
      }));
      garments = wardrobeItems
        .filter((item) => !item.retiredAt)
        .map((item) => ({ id: item.id, label: item.displayName }));
      nudge = nudgeResult;
    }
  }

  return (
    <RetailerTheme theme={retailer.brandTheme}>
      {children}
      <ProactiveNudgeWidget initialNudge={nudge} />
      <TableServiceWidget
        retailerId={retailer.id}
        retailerName={retailer.displayName}
        slug={slug}
        isSignedIn={session?.accountType === "customer"}
        weddingParties={weddingParties}
        garments={garments}
        {...(session?.accountType === "customer"
          ? { signedInMessagesHref: "/messages" }
          : {})}
      />
    </RetailerTheme>
  );
}
