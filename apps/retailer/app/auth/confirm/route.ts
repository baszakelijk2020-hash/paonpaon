import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * "invite" and "magiclink": Retailer Portal has no self-serve signup or
 * password-recovery flow, but a platform operator can still hand out a
 * one-click sign-in link (`auth.admin.generateLink({ type: "magiclink" })`)
 * for an already-provisioned account instead of a typed password —
 * extend this list rather than restructure the handler when "recovery"
 * is added. Deliberately a local literal type, not
 * `@supabase/supabase-js`'s `EmailOtpType`:
 * this app depends on `@paon/database`, not on `@supabase/supabase-js`
 * directly (pnpm's strict linking means only a package's own listed
 * dependencies resolve — see docs/DECISIONS.md ADR-001), and
 * `verifyOtp`'s parameter type still checks structurally against this
 * literal without needing that import.
 */
const ALLOWED_TYPES = ["invite", "magiclink"] as const;
type ConfirmationType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(value: string | null): value is ConfirmationType {
  return (ALLOWED_TYPES as readonly string[]).includes(value ?? "");
}

/**
 * The landing point for the link in an invite email (see
 * supabase/templates/invite.html, which uses `{{ .RedirectTo }}` —
 * set per-invite in each Server Action that calls
 * `auth.admin.inviteUserByEmail` — rather than the project-wide
 * `{{ .SiteURL }}`, since an invite must land on whichever app the
 * invited role belongs to). A Route Handler, not a Server Component,
 * because this is the entry point for a bare browser navigation
 * arriving from an external email client, not a call from this app's
 * own Server Components/Actions — see docs/API.md "Route Handlers".
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

  const landing = type === "invite" ? "/accept-invite" : "/dashboard";
  return NextResponse.redirect(`${origin}${landing}`);
}
