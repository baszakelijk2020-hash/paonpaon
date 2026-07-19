import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (!tokenHash || type !== "invite") {
    return NextResponse.redirect(`${origin}/login?error=invalid_invite`);
  }
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "invite",
    token_hash: tokenHash,
  });
  return NextResponse.redirect(
    error ? `${origin}/login?error=invalid_invite` : `${origin}/accept-invite`,
  );
}
