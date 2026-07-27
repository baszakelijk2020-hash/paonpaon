import { OrderRepository } from "@paon/database";
import { updateCartLineInputSchema } from "@paon/domain";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * The floating basket widget's fetch()-based twin of `cart/actions.ts`'s
 * `updateCartLine` Server Action — same RPC, same validation — needed
 * because the widget lives on the raw-served `/r/[slug]` page (see
 * `route.ts`'s own doc comment) where no Server Action can bind.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.accountType !== "customer") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    lineId?: string;
    quantity?: number;
  } | null;
  const parsed = updateCartLineInputSchema.safeParse({
    lineId: body?.lineId,
    quantity: body?.quantity,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  try {
    await new OrderRepository(await getSupabaseServerClient()).updateCartLine(
      parsed.data.lineId,
      parsed.data.quantity,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
