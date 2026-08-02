import { AppointmentRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { NextResponse } from "next/server";

import { assertRetailerModuleActive } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Fetch twin for the storefront HTML Book Appointment chrome — same
 * ADR-034 narrow anonymous write pattern as `api/table-service-inquiry`.
 * The raw `/r/[slug]` page cannot bind Server Actions.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    retailerId?: string;
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
    startsAt?: string;
    endsAt?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const retailerId = (body.retailerId ?? "").trim();
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const phone = (body.phone ?? "").trim();
  const notes = (body.notes ?? "").trim();
  const startsAt = (body.startsAt ?? "").trim();
  const endsAt = (body.endsAt ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!retailerId) fieldErrors.retailerId = "Missing retailer.";
  if (!name) fieldErrors.name = "Your name is required.";
  if (!email || !email.includes("@")) {
    fieldErrors.email = "A valid email is required.";
  }
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
    fieldErrors.startsAt = "Choose a date and time.";
  }
  if (!endsAt || Number.isNaN(Date.parse(endsAt))) {
    fieldErrors.endsAt = "Choose a date and time.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ fieldErrors }, { status: 400 });
  }

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

  const repo = new AppointmentRepository(supabase);
  try {
    const appointmentId = await repo.requestGuestAppointment({
      retailerId: rId,
      name,
      email,
      startsAt,
      endsAt,
      ...(phone ? { phone } : {}),
      ...(notes ? { notes } : {}),
      type: "fitting",
    });
    return NextResponse.json({ ok: true, appointmentId });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong.";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
