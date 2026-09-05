import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getStorefrontPageData } from "../get-storefront-page-data";
import { serializeStorefrontPage } from "../storefront-page-data";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Serves the storefront template's CSS for the React route.
 *
 * Why a Route Handler rather than importing a .css file:
 *
 *  1. Completeness. Some style blocks are generated per request rather than
 *     living in paon-template.html — `<style id="paon-retailer-brand">` in
 *     get-storefront-page-data.ts defines --font-retailer-display /
 *     --font-retailer-body and #sidebar-logo. A build-time extraction from the
 *     template file misses them, so the footer and .paon-catalogue-note fell
 *     back to the customer app's fonts instead of OptimaKlein.
 *
 *  2. Fidelity. Next's CSS pipeline (Lightning CSS) rewrites what it bundles.
 *     It collapsed each `backdrop-filter` / `-webkit-backdrop-filter` pair to
 *     the `-webkit-` one, which current Chrome ignores, silently removing
 *     every blur on the page. Serving the bytes directly avoids any rewriting.
 *
 * Exactly one transformation is applied, `:root` -> `:root, .paon-template-root`,
 * because the customer app also defines --text, --mid and friends at :root and
 * wins the cascade there; re-declaring the same block on the template's own
 * root restores the template's values for its subtree. Media-query context is
 * preserved since the selector is rewritten in place.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const pageData = await getStorefrontPageData(slug, authData, null);
  if (!pageData) {
    return new NextResponse("/* unknown retailer */", {
      status: 404,
      headers: { "content-type": "text/css; charset=utf-8" },
    });
  }

  const template = await readFile(
    path.join(process.cwd(), "app/(shell)/r/[slug]/paon-template.html"),
    "utf8",
  );
  const html = serializeStorefrontPage(template, pageData);

  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1])
    .join("\n")
    .replace(
      /(^|[\s,{}])(:root)(\s*[,{])/g,
      (_match, before: string, _sel: string, after: string) =>
        `${before}:root, .paon-template-root${after}`,
    );

  /*
   * The parity layer is appended here rather than `import`ed by page.tsx so it
   * is guaranteed to come after the template's own blocks.
   *
   * As a bundled import it landed in <head> ahead of this stylesheet, so on
   * any `!important` collision the template still won — the shared sidebar's
   * brand shimmer stayed dead (`animation: none`, gradient blanked) no matter
   * how the override was written, while non-!important collisions like
   * `position` did get fixed. Same origin, same request, last in the file:
   * the parity rules now win on equal footing.
   */
  const parity = await readFile(
    path.join(process.cwd(), "app/(shell)/r/[slug]/paon-template-parity.css"),
    "utf8",
  );

  return new NextResponse(`${css}\n\n${parity}`, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
