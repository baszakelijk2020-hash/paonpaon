import { resolveAppSession } from "@paon/auth";
import { createSupabaseServerClient } from "@paon/database";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "./lib/env";

const PUBLIC_PATHS = ["/login", "/accept-invite", "/auth/confirm"];

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

  const { data } = await supabase.auth.getUser();
  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  // /auth/confirm establishes the session itself (verifyOtp) — never
  // gate it behind an existing session check.
  if (request.nextUrl.pathname.startsWith("/auth/confirm")) {
    return response;
  }

  if (!data.user) {
    if (isPublicPath) {
      return response;
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = resolveAppSession(data.user);

  if (session.accountType !== "retailer_staff") {
    await supabase.auth.signOut();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "not_retailer_staff");
    return NextResponse.redirect(loginUrl);
  }

  // Whether this session has finished accept-invite (accepted_at set)
  // isn't a JWT claim (see docs/DATABASE.md "JWT claim sync") — only
  // retailer_id/retailer_role are mirrored there — so that check stays
  // in lib/session.ts's requireSession, not here, rather than adding a
  // database round trip to every middleware invocation.
  if (request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
