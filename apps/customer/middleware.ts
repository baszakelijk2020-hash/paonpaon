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

// The Employee Portal (PHASE 18.5) — a corporate wearer, never an
// ordinary customer. Lives inside this app under its own path prefix
// rather than a fourth Next.js app (see docs/PHASE.md 18.5's Status for
// why), so it needs its own carve-out from the customer-only check
// below: a wearer must never be treated as "not a customer account" on
// their own pages, and a signed-in customer wandering onto `/employee`
// must be redirected there, never signed out of their real session.
const EMPLOYEE_PATH_PREFIX = "/employee";

// The Manager Portal (PHASE 14.1) — a corporate account administrator,
// never an ordinary customer. Same carve-out pattern as the employee
// portal: a manager must never be treated as "not a customer account" on
// their own pages, and a signed-in customer wandering onto `/manager`
// must be redirected there, never signed out.
const MANAGER_PATH_PREFIX = "/manager";

// Server-to-server routes with their own auth (Stripe signature
// verification) — never gate them behind a browser session. A real
// Stripe webhook call never sends this app's session cookie, so
// without this bypass the session redirect below fires first and the
// route is unreachable by its real caller in any deployment.
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

  if (pathname === "/") {
    return response;
  }

  // /auth/confirm, /employee/auth/confirm, and /manager/auth/confirm
  // establish the session themselves (verifyOtp) — never gate any behind
  // an existing session check.
  if (
    pathname.startsWith("/auth/confirm") ||
    pathname.startsWith(`${EMPLOYEE_PATH_PREFIX}/auth/confirm`) ||
    pathname.startsWith(`${MANAGER_PATH_PREFIX}/auth/confirm`)
  ) {
    return response;
  }

  if (pathname.startsWith(STOREFRONT_PATH_PREFIX)) {
    return response;
  }

  // Same-origin proxy for paon-template.html's @font-face URLs (see
  // PUBLIC_PATHS above) — a pure byte-serving utility path with no
  // account-specific content, fetched as a background subresource by
  // every page that embeds the template regardless of who is signed
  // in. Real bug this fixed (PHASE 18.8): without this early return, a
  // signed-in corporate_wearer's font request fell through to the
  // generic "not a customer account" branch below (which correctly
  // signs out a retailer_staff/platform session that wanders onto an
  // actual customer-app page) and silently signed the wearer OUT —
  // `Set-Cookie: ...; Max-Age=0` on the font response itself — seconds
  // after `/employee` rendered correctly. The Server Action POST that
  // failed moments later with "no user" was a real symptom, not the
  // cause: the cookie was already gone by the time the wearer finished
  // filling out the form, deleted by a font byte request they never
  // saw. Confirmed via CDP-level `Network.responseReceivedExtraInfo`
  // tracing (Playwright's own `response.headers()` does not expose
  // `Set-Cookie`, matching real browser JS restrictions, and hid this
  // from an earlier investigation's `page.on(...)` instrumentation).
  if (pathname.startsWith("/fonts")) {
    return response;
  }

  const isEmployeePath = pathname.startsWith(EMPLOYEE_PATH_PREFIX);
  const isEmployeeLoginPath = pathname.startsWith(
    `${EMPLOYEE_PATH_PREFIX}/login`,
  );
  const isManagerPath = pathname.startsWith(MANAGER_PATH_PREFIX);
  const isManagerLoginPath = pathname.startsWith(
    `${MANAGER_PATH_PREFIX}/login`,
  );
  const isPublicPath =
    isEmployeeLoginPath ||
    isManagerLoginPath ||
    PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    if (isPublicPath) {
      return response;
    }
    const loginUrl = new URL(
      isEmployeePath
        ? `${EMPLOYEE_PATH_PREFIX}/login`
        : isManagerPath
          ? `${MANAGER_PATH_PREFIX}/login`
          : "/login",
      request.url,
    );
    loginUrl.searchParams.set("redirectTo", pathname);
    return redirectWithCookies(loginUrl, response);
  }

  const session = resolveAppSession(data.user);

  if (isEmployeePath) {
    // A wearer is welcome here; anyone else (customer, retailer staff,
    // platform) is blocked from this one area WITHOUT touching their
    // session — visiting `/employee` by mistake must never sign a
    // shopper out of their own account.
    if (session.accountType !== "corporate_wearer") {
      if (isEmployeeLoginPath) {
        return response;
      }
      const loginUrl = new URL(`${EMPLOYEE_PATH_PREFIX}/login`, request.url);
      loginUrl.searchParams.set("error", "not_an_employee_account");
      return redirectWithCookies(loginUrl, response);
    }
    if (isEmployeeLoginPath) {
      return redirectWithCookies(
        new URL(EMPLOYEE_PATH_PREFIX, request.url),
        response,
      );
    }
    return response;
  }

  if (isManagerPath) {
    // A manager is welcome here; anyone else (customer, wearer, retailer
    // staff, platform) is blocked from this one area WITHOUT touching their
    // session — visiting `/manager` by mistake must never sign a shopper or
    // wearer out of their own account.
    if (session.accountType !== "corporate_manager") {
      if (isManagerLoginPath) {
        return response;
      }
      const loginUrl = new URL(`${MANAGER_PATH_PREFIX}/login`, request.url);
      loginUrl.searchParams.set("error", "not_a_manager_account");
      return redirectWithCookies(loginUrl, response);
    }
    if (isManagerLoginPath) {
      return redirectWithCookies(
        new URL(MANAGER_PATH_PREFIX, request.url),
        response,
      );
    }
    return response;
  }

  if (session.accountType !== "customer") {
    await supabase.auth.signOut();
    // Marketing and /demo/[token] are public — clear the wrong session and
    // continue, instead of trapping the visitor on the customer login page.
    // A corporate_wearer or corporate_manager session lands here exactly
    // like retailer_staff or platform always has: this app's ordinary paths
    // are not theirs either.
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
