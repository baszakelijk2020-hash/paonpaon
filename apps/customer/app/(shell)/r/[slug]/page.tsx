import { notFound } from "next/navigation";

import { getStorefrontPageData } from "./get-storefront-page-data";
import { StorefrontCategory } from "./storefront-category";

import { getSupabaseServerClient } from "@/lib/supabase-server";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
}

/**
 * The storefront URL. It renders nothing.
 *
 * The storefront itself is built once per session by StorefrontHost, mounted
 * in the (shell) layout that wraps both environments and never unmounts. That
 * is the whole point: as a page it was torn down and rebuilt every time the
 * visitor stepped into the customer environment, however much of it was cached
 * on the way out.
 *
 * What is left here is the route existing, 404ing for a retailer that does
 * not, and handing the host the category from the URL.
 */
export default async function Page({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { category } = await searchParams;

  const supabase = await getSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const pageData = await getStorefrontPageData(slug, authData, null);
  if (!pageData) {
    notFound();
  }

  return <StorefrontCategory category={category ?? null} />;
}
