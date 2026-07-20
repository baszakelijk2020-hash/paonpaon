import { requireRetailerRole } from "@paon/auth";
import {
  RetailerStaffRepository,
  StaffRosterRepository,
  totalHours,
} from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { redirect } from "next/navigation";

import { createStaffShift, deleteStaffShift } from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function startOfWeek(date: Date): Date {
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function StaffRosterPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    redirect("/staff");
  }

  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByRetailer(
    session.retailerId,
  );

  const monday = startOfWeek(new Date());
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const from = toISODate(monday);
  const to = toISODate(sunday);

  const rosterRepo = new StaffRosterRepository(supabase);
  const [shifts, timeEntries] = await Promise.all([
    rosterRepo.findShiftsByRetailer(session.retailerId, { from, to }),
    rosterRepo.findTimeEntriesByRetailer(session.retailerId, {
      from: monday.toISOString(),
      to: new Date(sunday.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    }),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return toISODate(d);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
          Staff roster
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Week of {from} — hours are calculated from actual clock-in/out, not
          scheduled shifts.
        </p>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-stone-100)] text-left">
              <th className="px-4 py-3 font-medium text-[var(--color-stone-500)]">
                Staff
              </th>
              {days.map((day, i) => (
                <th
                  key={day}
                  className="px-4 py-3 font-medium text-[var(--color-stone-500)]"
                >
                  {DAY_LABELS[i]}
                </th>
              ))}
              <th className="px-4 py-3 font-medium text-[var(--color-stone-500)]">
                Hours (worked)
              </th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => {
              const memberEntries = timeEntries.filter(
                (entry) => entry.staffId === member.id,
              );
              const hours = totalHours(memberEntries);
              return (
                <tr
                  key={member.id}
                  className="border-b border-[var(--color-stone-100)] last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-stone-900)]">
                    {member.fullName}
                  </td>
                  {days.map((day) => {
                    const dayShifts = shifts.filter(
                      (s) => s.staffId === member.id && s.shiftDate === day,
                    );
                    return (
                      <td key={day} className="px-4 py-3 align-top">
                        {dayShifts.map((shift) => (
                          <form
                            key={shift.id}
                            action={deleteStaffShift}
                            className="mb-1 flex items-center gap-1"
                          >
                            <input
                              type="hidden"
                              name="shiftId"
                              value={shift.id}
                            />
                            <span className="text-xs text-[var(--color-stone-700)]">
                              {shift.startTime.slice(0, 5)}–
                              {shift.endTime.slice(0, 5)}
                            </span>
                            <button
                              type="submit"
                              aria-label="Remove shift"
                              className="text-xs text-[var(--color-stone-400)] hover:text-[var(--color-danger-500)]"
                            >
                              ✕
                            </button>
                          </form>
                        ))}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-[var(--color-stone-700)]">
                    {hours.toFixed(1)}h
                  </td>
                </tr>
              );
            })}
            {staff.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-[var(--color-stone-500)]"
                >
                  No staff yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Add a shift
        </h2>
        <Card>
          <form
            action={createStaffShift}
            className="flex flex-wrap items-end gap-3"
          >
            <FormField label="Staff" htmlFor="staffId">
              <Select id="staffId" name="staffId" required>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Date" htmlFor="shiftDate">
              <Input id="shiftDate" name="shiftDate" type="date" required />
            </FormField>
            <FormField label="Start" htmlFor="startTime">
              <Input id="startTime" name="startTime" type="time" required />
            </FormField>
            <FormField label="End" htmlFor="endTime">
              <Input id="endTime" name="endTime" type="time" required />
            </FormField>
            <button type="submit" className={buttonVariants({ size: "sm" })}>
              Add shift
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
