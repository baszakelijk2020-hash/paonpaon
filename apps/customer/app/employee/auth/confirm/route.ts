import { CorporateRepository } from "@paon/database";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/** Mirrors `app/auth/confirm/route.ts` exactly, except it links a
 * `corporate_wearers` row (`linkMyWearerAccount`) instead of a
 * `customers` row, and its default landing page is `/employee`. Only
 * "magiclink" is issued — see the customer confirm route for why this
 * is a local literal type, not `@supabase/supabase-js`'s `EmailOtpType`. */
const ALLOWED_TYPES = ["magiclink"] as const;
type ConfirmationType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(value: string | null): value is ConfirmationType {
  return (ALLOWED_TYPES as readonly string[]).includes(value ?? "");
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const nextRaw = searchParams.get("next") ?? "/employee";
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : "/employee";

  if (!tokenHash || !isAllowedType(type)) {
    return NextResponse.redirect(
      `${origin}/employee/login?error=invalid_invite`,
    );
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(
      `${origin}/employee/login?error=invalid_invite`,
    );
  }

  await new CorporateRepository(supabase).linkMyWearerAccount();

  // `linkMyWearerAccount` just set `corporate_wearers.user_id`, and its
  // trigger wrote the `wearer_id` claim onto `auth.users` — but the
  // access token minted by `verifyOtp` above was issued a moment
  // earlier, before that claim existed, and `auth.jwt()`-based checks
  // (this app's own `resolveAppSession`, this database's RLS) decode
  // that token locally rather than re-fetching. Without an explicit
  // refresh here, a wearer's very first sign-in would carry a session
  // that resolves as an ordinary customer until their token happens to
  // rotate on its own.
  await supabase.auth.refreshSession();

  return NextResponse.redirect(`${origin}${next}`);
}
