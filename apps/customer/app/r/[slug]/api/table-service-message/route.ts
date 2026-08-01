import { RetailerRepository } from "@paon/database";
import { NextResponse } from "next/server";

import { sendSignedInTableServiceMessage } from "../../table-service-actions";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Multipart bridge for the founder-authored raw HTML storefront. The React
 * child routes can call the Server Action directly; the exact founder page is
 * served by a Route Handler and therefore needs this same-origin boundary.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await getSession();
  if (!session || session.accountType !== "customer") {
    return NextResponse.json(
      { error: "Sign in to send private consultation material." },
      { status: 401 },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }
  const retailerId = String(formData.get("retailerId") ?? "");
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.id !== retailerId) {
    return NextResponse.json(
      { error: "Retailer context does not match." },
      { status: 400 },
    );
  }
  const result = await sendSignedInTableServiceMessage(retailerId, formData);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
