import {
  AppointmentClosureRepository,
  RetailerBranchRepository,
} from "@paon/database";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";

import { removeClosure } from "./actions";
import { ClosureForm } from "./closure-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const WHEN = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Date-specific closures. Recurring weekly hours live under Availability; this
 * is the layer that says "not on the 26th" — a public holiday, a stocktake, an
 * afternoon held for one private fitting.
 *
 * A closure is enforced, not advisory: `appointment_slot_conflict()` reads this
 * table on every customer booking and reschedule, so a closed window cannot be
 * booked into even by a direct call.
 */
export default async function ClosuresPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const [closures, branches] = await Promise.all([
    new AppointmentClosureRepository(supabase).findUpcomingByRetailer(
      session.retailerId,
    ),
    new RetailerBranchRepository(supabase).listByRetailer(session.retailerId),
  ]);

  const branchNameById = new Map(
    branches.map((branch) => [branch.id as string, branch.name]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Closures
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Days and hours you take no appointments. Customers cannot book into a
          closure, and an existing booking inside one is left alone for you to
          move or cancel.
        </p>
      </div>

      <Card className="p-6">
        <ClosureForm
          branches={branches.map((branch) => ({
            id: branch.id as string,
            name: branch.name,
          }))}
        />
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-lg text-[var(--color-stone-900)]">
          Coming up
        </h2>
        {closures.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No closures scheduled. Your published opening hours apply.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-[var(--color-stone-100)]">
            {closures.map((closure) => (
              <li
                key={closure.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm text-[var(--color-stone-900)]">
                    {WHEN.format(new Date(closure.startsAt))} &ndash;{" "}
                    {WHEN.format(new Date(closure.endsAt))}
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {closure.branchId
                      ? (branchNameById.get(closure.branchId as string) ??
                        "One branch")
                      : "Every branch"}
                    {closure.reason ? ` · ${closure.reason}` : ""}
                  </p>
                </div>
                <form action={removeClosure}>
                  <input type="hidden" name="closureId" value={closure.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
