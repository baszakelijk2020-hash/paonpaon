import { resolveAppSession } from "@paon/auth";
import { createSupabaseServerClient } from "@paon/database";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "./lib/env";

const PUBLIC_PATHS = ["/login", "/auth/confirm", "/accept-invite"];

const STOREFRONT_PATH_PREFIX = "/r/"; // Retailer storefront path prefix

// Server-to-server routes with their own auth (webhook signature
// verification) — never gate them behind a browser session. A real
// Faden webhook call never sends this app's session cookie, so without
// this bypass the session redirect below fires first and the route is
// unreachable by its real caller in any deployment.
const SERVER_TO_SERVER_PATH_PREFIX = "/api/webhooks/";

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
  if (request.nextUrl.pathname.startsWith(SERVER_TO_SERVER_PATH_PREFIX)) {
    return NextResponse.next({ request });
  }

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

  // Handle public paths
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

  // Reject any session that isn't a Retailer Portal staff account.
  if (session.accountType !== "retailer_staff") {
    await supabase.auth.signOut();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "not_a_retailer_account");
    return redirectWithCookies(loginUrl, response);
  }

  // Redirect to dashboard after login
  if (pathname.startsWith("/login")) {
    return redirectWithCookies(new URL("/dashboard", request.url), response);
  }

  return response;
}

// Configuration for middleware

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - fonts (same-origin font proxy — a public static asset a
     *   logged-out browser must be able to fetch for @font-face)
     */
    "/((?!_next/static|_next/image|favicon.ico|fonts/).*)",
  ],
};
