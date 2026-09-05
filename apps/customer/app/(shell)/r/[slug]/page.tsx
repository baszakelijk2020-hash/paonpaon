import { readFile } from "node:fs/promises";
import path from "node:path";

import { notFound } from "next/navigation";
import { cache } from "react";

import { getStorefrontPageData } from "./get-storefront-page-data";
import "./paon-preflight-reset.css";
import { serializeStorefrontPage } from "./storefront-page-data";
import { TemplateMount } from "./template-mount";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * The template is ~700KB and never changes at runtime, so it is read from disk
 * once per server process rather than on every storefront request.
 * `cache()` also dedupes it across the page and its sibling data fetches
 * within a single render.
 */
const readTemplate = cache(async () =>
  readFile(
    path.join(process.cwd(), "app/(shell)/r/[slug]/paon-template.html"),
    "utf8",
  ),
);

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
}

/**
 * The storefront. Renders the founder template itself, not a
 * reimplementation of it.
 *
 * `route.ts` serves paon-template.html byte-for-byte at /r/[slug]. This page
 * runs the identical data path (getStorefrontPageData -> serializeStorefrontPage)
 * and mounts the identical output inside the React tree, so the DOM, class
 * names, ids, inline styles and the 38 <script> blocks are the same bytes
 * rather than a transcription.
 *
 * The 63 <style> blocks live in ./paon-template.css, extracted verbatim in
 * document order so the cascade is unchanged. It is imported (not rendered as
 * an inline <style>) because a <style> element emitted into <body> is made
 * visible as text by the template's own aggressive display rules.
 */
export default async function Page({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { category } = await searchParams;

  const supabase = await getSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const pageData = await getStorefrontPageData(
    slug,
    authData,
    category ?? null,
  );
  if (!pageData) {
    notFound();
  }

  const template = await readTemplate();
  const html = serializeStorefrontPage(template, pageData);

  // External scripts (GSAP, ScrollTrigger) in document order.
  const externalScripts = [
    ...html.matchAll(/<script[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/g),
  ].map((match) => match[1] as string);

  // Inline scripts in document order (head first, then body), re-executed
  // client-side because innerHTML-inserted scripts never run.
  const inlineScripts = [
    ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
  ].map((match) => match[1] as string);

  // Anchor the body scan after </head>: a CSS comment in the head styles
  // contains the literal text "<body>", which a naive /<body[^>]*>/ match
  // would latch onto and drag the whole head into the output.
  const headEnd = html.indexOf("</head>");
  const afterHead = headEnd === -1 ? html : html.slice(headEnd);
  const bodyOpen = afterHead.search(/<body[^>]*>/);
  const bodyInner =
    bodyOpen === -1
      ? ""
      : afterHead
          .slice(afterHead.indexOf(">", bodyOpen) + 1)
          .replace(/<\/body>[\s\S]*$/, "");

  const bodyHtml = bodyInner
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, "");

  // The template's own <aside> is left in the markup untouched so the HTML
  // parser builds exactly the DOM it builds on the raw page (its `.layout`
  // and `<main>` are never closed, so nesting of later siblings depends on
  // the parser). It is hidden by paon-template-parity.css, which keeps its
  // 250px grid column occupied, and the customer environment's
  // ShopCategorySidebar is laid over that column instead.
  /*
   * The stylesheet is handed to TemplateMount rather than rendered here as
   * <link precedence="default">. React keeps a stylesheet with a precedence
   * mounted across client navigations, so the template's rules followed the
   * visitor back into the customer environment and restyled it. TemplateMount
   * attaches and removes it alongside the markup it belongs to.
   *
   * It comes from a Route Handler so it is byte-exact and includes the
   * per-request <style id="paon-retailer-brand"> block;
   * ./paon-template-parity.css is appended there, after the template's own
   * blocks, so the parity rules can win an !important collision.
   * See ./template-styles/route.ts.
   */
  return (
    <TemplateMount
      bodyHtml={bodyHtml}
      externalScripts={externalScripts}
      inlineScripts={inlineScripts}
      stylesheetHref={`/r/${slug}/template-styles`}
      // One rendering per retailer, not per category. The template owns global
      // state — body classes, window functions — so building a second one in
      // the same document leaves the page contradicting itself. Category
      // changes are driven through the template's own navigation instead.
      cacheKey={slug}
      category={category ?? null}
    />
  );
}
