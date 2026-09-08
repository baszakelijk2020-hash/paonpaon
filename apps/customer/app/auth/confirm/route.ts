import { CustomerRepository } from "@paon/database";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Email signup, magic-link sign-in, and password recovery all land here.
 * Deliberately a local
 * literal type, not `@supabase/supabase-js`'s `EmailOtpType` — see
 * apps/retailer/app/auth/confirm/route.ts for why.
 */
const ALLOWED_TYPES = ["magiclink", "recovery", "signup"] as const;
type ConfirmationType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(value: string | null): value is ConfirmationType {
  return (ALLOWED_TYPES as readonly string[]).includes(value ?? "");
}

function safeInternalPath(value: string): string | null {
  return value.startsWith("/") && !/^\/[/\\]/.test(value) ? value : null;
}

/**
 * The landing point for the link in a magic-link sign-in email (see
 * supabase/templates/magic-link.html, which uses `{{ .RedirectTo }}` —
 * set per-request via `signInWithOtp`'s `emailRedirectTo` — rather than
 * the project-wide `{{ .SiteURL }}`). After establishing the session,
 * calls `link_my_customer_accounts` once (docs/DECISIONS.md ADR-013) so
 * any `customers` row matching this email is linked before the
 * dashboard renders. A Route Handler, not a Server Component, for the
 * same reason as the retailer app's — see docs/API.md "Route Handlers".
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeInternalPath(searchParams.get("next") ?? "") ?? "/dashboard";

  if (!tokenHash || !isAllowedType(type)) {
    return NextResponse.redirect(`${origin}/login?error=invalid_invite`);
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=invalid_invite`);
  }

  // Linking is an account-claim operation, so only a genuine sign-in link
  // receives it. Recovery and signup confirmations merely establish the
  // Auth session and must not create or attach customer records.
  if (type === "magiclink") {
    await new CustomerRepository(supabase).linkMyAccounts();
  }

  // Recovery URLs always land on the dedicated public password-update page;
  // never accept a destination from an email URL for this sensitive flow.
  return NextResponse.redirect(
    `${origin}${type === "recovery" ? "/account/update-password" : next}`,
  );
}
