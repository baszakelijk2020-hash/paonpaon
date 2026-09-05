import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { cache } from "react";

import { getStorefrontPageData } from "../get-storefront-page-data";
import { serializeStorefrontPage } from "../storefront-page-data";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * The storefront's markup and scripts, as data.
 *
 * The storefront is no longer a page that mounts and unmounts with the route —
 * it is built once per session and kept (see StorefrontHost). It therefore
 * needs its payload as something fetchable rather than as a rendered page.
 *
 * The template is ~700KB and never changes at runtime, so it is read once per
 * server process.
 */
const readTemplate = cache(async () =>
  readFile(
    path.join(process.cwd(), "app/(shell)/r/[slug]/paon-template.html"),
    "utf8",
  ),
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  /*
   * The category matters here even though the storefront switches category
   * client-side afterwards. A visitor arriving straight at a category URL
   * should get exactly the markup the server would have sent them — the same
   * initial state as /r/[slug]/raw — rather than the home feed built first and
   * then switched, which leaves both views in the document.
   */
  const category = new URL(request.url).searchParams.get("category");
  const supabase = await getSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const pageData = await getStorefrontPageData(slug, authData, category);
  if (!pageData) {
    return NextResponse.json({ error: "unknown retailer" }, { status: 404 });
  }

  const html = serializeStorefrontPage(await readTemplate(), pageData);

  // External scripts (GSAP, ScrollTrigger) in document order.
  const externalScripts = [
    ...html.matchAll(/<script[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/g),
  ].map((match) => match[1] as string);

  // Inline scripts in document order; they are re-executed client-side because
  // scripts inserted through innerHTML never run.
  const inlineScripts = [
    ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
  ].map((match) => match[1] as string);

  // Anchor the body scan after </head>: a CSS comment in the head styles
  // contains the literal text "<body>", which a naive match would latch onto
  // and drag the whole head into the output.
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

  return NextResponse.json(
    { bodyHtml, externalScripts, inlineScripts },
    { headers: { "cache-control": "no-store" } },
  );
}
