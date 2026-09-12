import { CustomerRepository } from "@paon/database";
import { RetailerTheme } from "@paon/ui/components/RetailerTheme";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PaonHeaderContrast } from "./paon-header-contrast";
import { getProactiveNudge } from "./proactive-nudge-actions";
import { ProactiveNudgeWidget } from "./proactive-nudge-widget";
import { getStorefrontRetailer } from "./storefront-context";
import { StorefrontReflow } from "./storefront-reflow";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Every `/r/[slug]` route needs the retailer resolved to render at all
 * (see `products/page.tsx`), so re-resolving it here doesn't add a query
 * child pages don't already pay for — it does mean the lookup happens twice
 * per request (here and again in the page), acceptable until there's a
 * shared request-level cache.
 *
 * TableService is the widget inside paon-template.html, not a React
 * component. The React port that used to mount here (the "How may we be of
 * service?" pill) was superseded by it and, being position:fixed on a
 * storefront that stays parked behind the customer environment, kept
 * surfacing where it had no business being.
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

  let nudge: Awaited<ReturnType<typeof getProactiveNudge>> = null;
  if (session?.accountType === "customer") {
    const customers = await new CustomerRepository(supabase).findByUserId(
      session.userId,
    );
    const customer = customers.find((row) => row.retailerId === retailer.id);
    if (customer) nudge = await getProactiveNudge(retailer.id);
  }

  return (
    <RetailerTheme theme={retailer.brandTheme}>
      {children}
      <StorefrontReflow />
      <PaonHeaderContrast />
      <ProactiveNudgeWidget initialNudge={nudge} />
    </RetailerTheme>
  );
}
