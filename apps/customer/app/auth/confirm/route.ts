import { CustomerRepository } from "@paon/database";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Only "magiclink" is issued today (Customer Portal login is
 * passwordless-only, per docs/PRODUCT.md — no OAuth provider is wired
 * up, since that needs external provider credentials this session
 * doesn't have; see docs/PROJECT_STATE.md). Deliberately a local
 * literal type, not `@supabase/supabase-js`'s `EmailOtpType` — see
 * apps/retailer/app/auth/confirm/route.ts for why.
 */
const ALLOWED_TYPES = ["magiclink"] as const;
type ConfirmationType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(value: string | null): value is ConfirmationType {
  return (ALLOWED_TYPES as readonly string[]).includes(value ?? "");
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

  await new CustomerRepository(supabase).linkMyAccounts();

  return NextResponse.redirect(`${origin}/dashboard`);
}
