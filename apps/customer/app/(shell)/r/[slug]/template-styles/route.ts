import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import postcss from "postcss";

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
 * One transformation is applied: every selector is scoped to the template —
 * see scopeToTemplate below.
 */

const TEMPLATE_ROOT = ".paon-template-root";

/**
 * Confine every rule in the template's stylesheet to the template.
 *
 * The sheet stays live for the whole session — `main#main` takes its
 * `height: 100vh` and its own scrolling from it, so dropping it relayouts
 * ~84,000px of catalogue and shows as a flash. But it was written for a page
 * it owned entirely, so its bare `body`, `main`, `aside` and `*` rules reach
 * the customer environment and restyle it: 13px type instead of 16px, and
 * every rem-derived width, gap and grid track shifting with it.
 *
 * Prefixing the selectors is what makes both possible. `html`, `:root` and
 * `body` become the template root itself, since that is what they mean here;
 * everything else is scoped beneath it. At-rules that carry no selectors —
 * @keyframes, @font-face, @property — are left exactly as they are, and
 * conditional groups are rewritten inside.
 */
function scopeToTemplate(css: string): string {
  const root = postcss.parse(css);

  const ROOT_LEVEL = new Set(["html", ":root", "body"]);
  // Groups whose children are ordinary rules and so must be rewritten too.
  const CONDITIONAL = new Set([
    "media",
    "supports",
    "container",
    "layer",
    "scope",
  ]);

  root.walkRules((rule) => {
    // A rule inside @keyframes is a keyframe selector (`from`, `50%`), not a
    // element selector — prefixing it would destroy the animation.
    const parent = rule.parent;
    if (
      parent &&
      parent.type === "atrule" &&
      !CONDITIONAL.has((parent as postcss.AtRule).name.toLowerCase())
    ) {
      return;
    }

    rule.selectors = rule.selectors.map((selector) => {
      const trimmed = selector.trim();
      if (!trimmed || trimmed.includes(TEMPLATE_ROOT)) return trimmed;
      if (ROOT_LEVEL.has(trimmed)) return TEMPLATE_ROOT;
      // `body.foo` / `html[dir=rtl]` qualify the root itself, not a descendant.
      const qualified = trimmed.match(/^(html|body|:root)(?=[.:#[])(.*)$/s);
      if (qualified) return `${TEMPLATE_ROOT}${qualified[2]}`;
      // A leading combinator ("> .x") has no meaning once scoped.
      const cleaned = trimmed.replace(/^[>+~]\s*/, "");
      return `${TEMPLATE_ROOT} ${cleaned}`;
    });
  });

  return root.toString();
}

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
    .join("\n");

  const scoped = scopeToTemplate(css);

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

  return new NextResponse(`${scoped}\n\n${parity}`, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
