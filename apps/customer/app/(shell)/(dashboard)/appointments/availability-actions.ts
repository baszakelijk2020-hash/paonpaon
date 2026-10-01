"use server";

import { AppointmentRepository } from "@paon/database";
import { asId } from "@paon/domain";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/** More than a working day of hourly slots is a malformed request. */
const MAX_SLOTS_PER_CHECK = 24;

/**
 * Which of a day's candidate slots cannot actually be booked, and why.
 *
 * A customer holds SELECT-only RLS on their OWN appointments, so they cannot
 * see that someone else has taken a slot — which is the whole reason this goes
 * through `appointment_slot_conflict`. That function is SECURITY DEFINER and
 * returns nothing but a reason string, so the booking UI can grey out a taken
 * time without ever exposing whose it is.
 *
 * The fan-out runs in one server action so the browser makes a single round
 * trip regardless of how many slots the day has.
 */
export async function findUnavailableSlots(params: {
  retailerId: string;
  branchId?: string;
  /** Slot starts, ISO, each assumed one hour long — the flow's own duration. */
  startsAt: readonly string[];
}): Promise<Record<string, string>> {
  await requireSession();

  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(params.retailerId)) return {};
  if (params.branchId && !uuid.test(params.branchId)) return {};

  const slots = params.startsAt.slice(0, MAX_SLOTS_PER_CHECK);
  if (slots.length === 0) return {};

  const repo = new AppointmentRepository(await getSupabaseServerClient());

  const results = await Promise.all(
    slots.map(async (startsAt) => {
      const start = Date.parse(startsAt);
      if (!Number.isFinite(start)) return null;
      const endsAt = new Date(start + 60 * 60_000).toISOString();
      try {
        const reason = await repo.slotConflict({
          retailerId: asId<"RetailerId">(params.retailerId),
          ...(params.branchId
            ? { branchId: asId<"RetailerBranchId">(params.branchId) }
            : {}),
          startsAt: new Date(start).toISOString(),
          endsAt,
        });
        return reason ? ([startsAt, reason] as const) : null;
      } catch {
        // A failed check must not make a bookable slot look unbookable; the
        // write path re-checks anyway and is the real gate.
        return null;
      }
    }),
  );

  return Object.fromEntries(
    results.filter(
      (entry): entry is readonly [string, string] => entry !== null,
    ),
  );
}
