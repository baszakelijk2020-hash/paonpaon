import { MessagingRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { NextResponse } from "next/server";

import { validateTableServiceInquiry } from "../../table-service-validation";

import { assertRetailerModuleActive } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * The fetch()-based twin of `table-service-actions.ts`'s
 * `submitTableServiceInquiry` Server Action — same validation, same
 * `MessagingRepository` call, same anonymous-write path (no session
 * required, ADR-034's `submit_table_service_inquiry` RPC does the real
 * authorization). Exists because `/r/[slug]`'s main page is served raw
 * by `route.ts` (byte-for-byte `paon.html`, deliberately outside the
 * React tree — see that file's own doc comment) so nothing on it can
 * bind to a Server Action; the vanilla `<script>` appended to
 * `paon-template.html` posts here instead, the same way the template's
 * own "Continue In-Store"/"Add to Bag" buttons already call
 * `api/cart-add` instead of a Server Action.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    retailerId?: string;
    name?: string;
    email?: string;
    message?: string;
    intent?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const validation = validateTableServiceInquiry(body);
  if (!validation.ok) {
    return NextResponse.json(
      { fieldErrors: validation.fieldErrors },
      { status: 400 },
    );
  }
  const { retailerId, name, email, message, intent } = validation.value;

  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);
  try {
    await assertRetailerModuleActive(
      supabase,
      rId,
      "relationship_intelligence",
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong.";
    return NextResponse.json({ error: errorMessage }, { status: 403 });
  }

  try {
    await new MessagingRepository(supabase).submitTableServiceInquiry({
      retailerId: rId,
      name,
      email,
      intent,
      message,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong.";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
