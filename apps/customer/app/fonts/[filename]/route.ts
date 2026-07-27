import { NextResponse } from "next/server";

/**
 * `paon-template.html`'s `@font-face` rules point at
 * `www.nebelspiegel.com/fonts/*.woff2` — the founder's own domain sends no
 * `Access-Control-Allow-Origin` header, so every browser silently drops the
 * font on any other origin (confirmed: production Vercel domains fail the
 * same way as localhost, this isn't dev-only). Proxying same-origin is the
 * only fix that doesn't touch the template's own declared font URLs, since
 * @font-face is a genuine CORS-gated resource fetch unlike `<img>`.
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
