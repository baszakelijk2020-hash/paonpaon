import {
  AvailabilityWindowRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";

import { deleteAvailabilityWindow } from "./actions";
import { AvailabilityForm } from "./availability-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default async function AvailabilityPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const staffRepo = new RetailerStaffRepository(supabase);
  const me = await staffRepo.findByUserId(session.userId);
  const canManageAnyone = retailerRoleAtLeast(session.retailerRole, "manager");
  const staffOptions = canManageAnyone
    ? await staffRepo.findByRetailer(session.retailerId)
    : null;

  const windows = await new AvailabilityWindowRepository(
    supabase,
  ).findByRetailer(session.retailerId);
  const staffNameById = new Map(
    (staffOptions ?? (me ? [me] : [])).map((member) => [
      member.id,
      member.fullName,
    ]),
  );
  const visibleWindows = canManageAnyone
    ? windows
    : windows.filter((window) => window.staffId === me?.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
          Availability
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          {canManageAnyone
            ? "Recurring bookable hours for your team."
            : "Your recurring bookable hours."}
        </p>
      </div>

      <Card>
        <AvailabilityForm
          staffOptions={staffOptions}
          defaultStaffId={me?.id ?? ""}
        />
      </Card>

      {visibleWindows.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            No availability windows set yet.
          </p>
        </div>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {visibleWindows.map((window) => (
            <div
              key={window.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {DAY_LABELS[window.dayOfWeek]} · {window.startTime}–
                  {window.endTime}
                </p>
                {canManageAnyone ? (
                  <p className="text-sm text-[var(--color-stone-500)]">
                    {staffNameById.get(window.staffId) ?? "Unknown staff"}
                  </p>
                ) : null}
              </div>
              <form action={deleteAvailabilityWindow.bind(null, window.id)}>
                <Button type="submit" variant="ghost" size="sm">
                  Remove
                </Button>
              </form>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
