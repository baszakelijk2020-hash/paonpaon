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
  "/demo",
];
// Storefront browsing (docs/DECISIONS.md ADR-014) — never gated behind
// a session, and never signs an unrelated session out just for
// visiting it (unlike the protected paths below).
const STOREFRONT_PATH_PREFIX = "/r/";

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
    return NextResponse.redirect(loginUrl);
  }

  const session = resolveAppSession(data.user);

  if (session.accountType !== "customer") {
    await supabase.auth.signOut();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "not_a_customer_account");
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
