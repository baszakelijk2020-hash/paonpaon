import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getStorefrontPageData } from "../get-storefront-page-data";
import { serializeStorefrontPage } from "../storefront-page-data";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Serves the founder's actual `paon.html` file, byte-for-byte.
 * Data building logic has been extracted to getStorefrontPageData() to
 * allow both this route and the React preview page to share the same
 * data contract.
 */

let templateCache: string | null = null;

async function loadTemplate(): Promise<string> {
  if (process.env.NODE_ENV !== "development" && templateCache) {
    return templateCache;
  }
  const templatePath = path.join(
    process.cwd(),
    "app/(shell)/r/[slug]/paon-template.html",
  );
  const raw = await readFile(templatePath, "utf8");
  templateCache = raw;
  return raw;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const requestedCategory = new URL(request.url).searchParams.get("category");

  const pageData = await getStorefrontPageData(
    slug,
    authData,
    requestedCategory,
  );
  if (!pageData) {
    return new NextResponse("Not found", { status: 404 });
  }

  const template = await loadTemplate();
  const html = serializeStorefrontPage(template, pageData);

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
