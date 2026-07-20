import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * "magiclink" alongside "invite": platform staff have no self-serve
 * signup, but a platform operator can still hand out a one-click
 * sign-in link (`auth.admin.generateLink({ type: "magiclink" })`) for
 * an already-provisioned account instead of a typed password —
 * extend this list rather than restructure the handler, same
 * reasoning as the retailer app's version of this file.
 */
const ALLOWED_TYPES = ["invite", "magiclink"] as const;
type ConfirmationType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(value: string | null): value is ConfirmationType {
  return (ALLOWED_TYPES as readonly string[]).includes(value ?? "");
}

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
  const landing = type === "invite" ? "/accept-invite" : "/dashboard";
  return NextResponse.redirect(
    error ? `${origin}/login?error=invalid_invite` : `${origin}${landing}`,
  );
}
