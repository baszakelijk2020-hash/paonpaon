import { NextResponse } from "next/server";

/**
 * `packages/ui/src/styles/globals.css`'s `@font-face` rules point here —
 * the founder's own nebelspiegel.com sends no `Access-Control-Allow-Origin`
 * header, so every browser silently drops the font on any other origin
 * (confirmed on production Vercel domains too, not dev-only). Proxying
 * same-origin is the only fix, since @font-face is a genuine CORS-gated
 * fetch unlike `<img>`. Mirrors `apps/customer/app/fonts/[filename]/route.ts`
 * — each app needs its own same-origin route, not a shared package, since
 * this is a Route Handler tied to that app's own origin.
 */
const ALLOWED_FONTS = new Set([
  "optimaklein.woff2",
  "aviano.woff2",
  "gtbold3.woff2",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  if (!ALLOWED_FONTS.has(filename)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const upstream = await fetch(
    `https://www.nebelspiegel.com/fonts/${filename}`,
    { next: { revalidate: 86400 } },
  );
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "content-type": "font/woff2",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
