import { resolveAppSession } from "@paon/auth";
import { createSupabaseServerClient } from "@paon/database";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "./lib/env";

const PUBLIC_PATHS = [
  "/login",
  "/auth/confirm",
  "/pricing",
  "/demo-request",
  "/consultation",
  "/pilot",
  "/discover",
  "/founder",
  "/demo",
  "/sitemap.xml",
  "/robots.txt",
  // Guest-browsable private-client shell — see how the portal looks
  // without a login wall; mutations still require a session.
  "/dashboard",
  "/wishlist",
  "/loyalty",
  "/orders",
  "/appointments",
  "/alterations",
  "/messages",
  "/events",
  "/wedding-parties",
  "/notifications",
  "/account",
  // Same-origin proxy for paon-template.html's @font-face URLs — the
  // founder's own domain sends no CORS header, so every page that embeds
  // this template (signed in or not) needs this reachable unauthenticated.
  "/fonts",
];
// Storefront browsing (docs/DECISIONS.md ADR-014) — never gated behind
// a session, and never signs an unrelated session out just for
// visiting it (unlike the protected paths below).
const STOREFRONT_PATH_PREFIX = "/r/";

/**
 * `NextResponse.redirect(...)` builds a brand-new response object, so
 * any cookies Supabase just refreshed (or cleared on sign-out) on
 * `response` during this request would otherwise be silently dropped
 * on every redirect — a known Supabase SSR pitfall. The browser keeps
 * the stale cookie, which Safari treats as invalid far more readily
 * than Chrome, producing an intermittent redirect loop that is nearly
 * impossible to reproduce outside Safari.
 */
function redirectWithCookies(url: URL, from: NextResponse): NextResponse {
  const to = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createSupabaseServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  );

  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return response;
  }

  // /auth/confirm establishes the session itself (verifyOtp) — never
  // gate it behind an existing session check.
  if (pathname.startsWith("/auth/confirm")) {
    return response;
  }

  if (pathname.startsWith(STOREFRONT_PATH_PREFIX)) {
    return response;
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    if (isPublicPath) {
      return response;
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return redirectWithCookies(loginUrl, response);
  }

  const session = resolveAppSession(data.user);

  if (session.accountType !== "customer") {
    await supabase.auth.signOut();
    // Marketing and /demo/[token] are public — clear the wrong session and
    // continue, instead of trapping the visitor on the customer login page.
    if (isPublicPath) {
      return response;
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "not_a_customer_account");
    return redirectWithCookies(loginUrl, response);
  }

  if (pathname.startsWith("/login")) {
    return redirectWithCookies(new URL("/dashboard", request.url), response);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
