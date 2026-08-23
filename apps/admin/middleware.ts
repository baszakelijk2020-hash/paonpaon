import { resolveAppSession } from "@paon/auth";
import { createSupabaseServerClient } from "@paon/database";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "./lib/env";

const PUBLIC_PATHS = ["/login", "/auth/confirm", "/accept-invite"];

// Server-to-server routes with their own auth (CRON_SECRET bearer token,
// Stripe signature verification) — never gate them behind a browser
// session. Vercel Cron and Stripe never send this app's session cookie,
// so without this bypass the session redirect below fires first and
// these routes are unreachable by their real callers in any deployment.
const SERVER_TO_SERVER_PATH_PREFIXES = ["/api/cron/", "/api/webhooks/"];

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

const PWA_METADATA_PATHS = ["/manifest.webmanifest", "/icon", "/apple-icon"];

export async function middleware(request: NextRequest) {
  if (
    SERVER_TO_SERVER_PATH_PREFIXES.some((prefix) =>
      request.nextUrl.pathname.startsWith(prefix),
    )
  ) {
    return NextResponse.next({ request });
  }

  if (PWA_METADATA_PATHS.includes(request.nextUrl.pathname)) {
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

  const { data } = await supabase.auth.getUser();
  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!data.user) {
    if (isPublicPath) {
      return response;
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return redirectWithCookies(loginUrl, response);
  }

  const session = resolveAppSession(data.user);

  if (session.accountType !== "platform") {
    await supabase.auth.signOut();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "not_platform_staff");
    return redirectWithCookies(loginUrl, response);
  }

  if (isPublicPath && request.nextUrl.pathname.startsWith("/login")) {
    return redirectWithCookies(new URL("/retailers", request.url), response);
  }

  return response;
}

export const config = {
  // fonts/ excluded: the same-origin font proxy is a public static
  // asset a logged-out browser must be able to fetch for @font-face.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/|manifest.webmanifest|icon).*)",
  ],
};
