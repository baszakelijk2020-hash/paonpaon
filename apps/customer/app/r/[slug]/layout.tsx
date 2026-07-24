import { RetailerRepository } from "@paon/database";
import { RetailerTheme } from "@paon/ui/components/RetailerTheme";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { TableServiceWidget } from "./table-service-widget";

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
  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") {
    notFound();
  }

  return (
    <RetailerTheme theme={retailer.brandTheme}>
      {children}
      <TableServiceWidget
        retailerId={retailer.id}
        retailerName={retailer.displayName}
      />
    </RetailerTheme>
  );
}
