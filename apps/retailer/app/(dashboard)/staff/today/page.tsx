import {
  AppointmentRepository,
  ClientelingOpportunityRepository,
  RetailerStaffRepository,
  ShiftCloseoutRepository,
  StaffRecognitionRepository,
  StaffRosterRepository,
} from "@paon/database";
import {
  APPOINTMENT_TYPE_LABELS,
  type Appointment,
  type RecognitionAct,
  type StaffShift,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { AssignedOpportunityList } from "./assigned-opportunity-list";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function isToday(isoDate: string): boolean {
  const target = new Date(isoDate);
  const now = new Date();
  return (
    target.getUTCFullYear() === now.getUTCFullYear() &&
    target.getUTCMonth() === now.getUTCMonth() &&
    target.getUTCDate() === now.getUTCDate()
  );
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeOnly(timeStr: string | undefined): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  const hours = parts[0];
  const minutes = parts[1];
  if (!hours || !minutes) return "";
  const h = parseInt(hours, 10);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${minutes} ${period}`;
}

/**
 * Unified role home (PHASE 11.2 / WFM-103). A read-only personal landing
 * page for a staff member's day, composing: clock/shift status, appointments
 * needing preparation today, today's promises/tasks, recognition, and
 * end-of-shift closeout status.
 */
export default async function StaffTodayPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const staffRepo = new RetailerStaffRepository(supabase);
  const rosterRepo = new StaffRosterRepository(supabase);
  const appointmentRepo = new AppointmentRepository(supabase);
  const closeoutRepo = new ShiftCloseoutRepository(supabase);
  const recognitionRepo = new StaffRecognitionRepository(supabase);
  const opportunityRepo = new ClientelingOpportunityRepository(supabase);

  const today = new Date().toISOString().slice(0, 10);

  const [
    viewer,
    shifts,
    openEntry,
    appointments,
    closeout,
    recentActs,
    assignedOpportunities,
  ] = await Promise.all([
    staffRepo.findByUserId(session.userId),
    rosterRepo.findShiftsByRetailer(session.retailerId, {
      from: today,
      to: today,
    }),
    staffRepo
      .findByUserId(session.userId)
      .then((staff) => (staff ? rosterRepo.findOpenTimeEntry(staff.id) : null)),
    appointmentRepo.findByRetailer(session.retailerId),
    staffRepo.findByUserId(session.userId).then((staff) =>
      staff
        ? closeoutRepo.findByStaffAndDate({
            retailerId: session.retailerId,
            staffId: staff.id,
            closeoutDate: today,
          })
        : null,
    ),
    staffRepo.findByUserId(session.userId).then((staff) =>
      staff
        ? recognitionRepo.listForStaff({
            retailerId: session.retailerId,
            staffId: staff.id,
            limit: 5,
          })
        : Promise.resolve([]),
    ),
    staffRepo
      .findByUserId(session.userId)
      .then((staff) =>
        staff
          ? opportunityRepo.listOpenAssignedToStaff(
              session.retailerId,
              staff.id,
            )
          : Promise.resolve([]),
      ),
  ]);

  if (!viewer) {
    throw new Error("Viewer staff record not found");
  }

  // Filter shifts to today's shifts for this staff member
  const todayShifts = shifts.filter((shift) => shift.staffId === viewer.id);

  // Filter appointments to today's open appointments for this staff member
  const todayAppointments = appointments.filter(
    (apt) =>
      isToday(apt.startsAt) &&
      apt.staffId === viewer.id &&
      !["completed", "canceled", "no_show"].includes(apt.status),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          My Day
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">{today}</p>
      </div>

      {/* Shift and Clock Status */}
      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Shift & Clock Status
        </h2>
        <div className="mt-4 space-y-4">
          {todayShifts.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-[var(--color-stone-600)]">
                Scheduled Shift
              </p>
              {todayShifts.map((shift: StaffShift) => (
                <div key={shift.id} className="mt-2">
                  <p className="font-display text-lg text-[var(--color-stone-900)]">
                    {formatTimeOnly(shift.startTime)} –{" "}
                    {formatTimeOnly(shift.endTime)}
                  </p>
                  {shift.notes ? (
                    <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                      {shift.notes}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-stone-500)]">
              No shift scheduled for today.
            </p>
          )}

          {openEntry ? (
            <div className="border-t border-[var(--color-stone-100)] pt-4">
              <p className="text-xs font-medium text-[var(--color-stone-600)]">
                Clock Status
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-[var(--color-green-500)]" />
                <p className="text-sm text-[var(--color-stone-900)]">
                  Clocked in at {formatTime(openEntry.clockInAt)}
                </p>
              </div>
            </div>
          ) : (
            <div className="border-t border-[var(--color-stone-100)] pt-4">
              <p className="text-xs font-medium text-[var(--color-stone-600)]">
                Clock Status
              </p>
              <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                Not currently clocked in.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Today's Appointments */}
      {todayAppointments.length > 0 ? (
        <Card>
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Appointments Today ({todayAppointments.length})
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            {todayAppointments
              .sort(
                (a: Appointment, b: Appointment) =>
                  new Date(a.startsAt).getTime() -
                  new Date(b.startsAt).getTime(),
              )
              .map((appointment: Appointment) => (
                <li
                  key={appointment.id}
                  className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-display text-lg text-[var(--color-stone-900)]">
                        {formatTime(appointment.startsAt)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--color-stone-600)]">
                        {APPOINTMENT_TYPE_LABELS[appointment.type]}
                      </p>
                      {appointment.notes ? (
                        <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                          {appointment.notes}
                        </p>
                      ) : null}
                    </div>
                    <Link
                      href={`/appointments/${appointment.id}`}
                      className="text-xs text-[var(--color-blue-600)] hover:underline"
                    >
                      View →
                    </Link>
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}

      <AssignedOpportunityList opportunities={assignedOpportunities} />

      {/* Closeout Status */}
      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Shift Closeout
        </h2>
        <div className="mt-4 space-y-4">
          {closeout ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--color-stone-600)]">
                    Closeout submitted
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                    {formatDate(closeout.submittedAt, "en-US")}
                  </p>
                </div>
                <Badge tone="success">Completed</Badge>
              </div>
              <div className="mt-3 space-y-2 border-t border-[var(--color-stone-100)] pt-3 text-sm">
                <div>
                  <p className="font-medium text-[var(--color-stone-600)]">
                    Promises:
                  </p>
                  <p className="text-[var(--color-stone-700)]">
                    {closeout.promisesNote}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-[var(--color-stone-600)]">
                    What worked:
                  </p>
                  <p className="text-[var(--color-stone-700)]">
                    {closeout.whatWorkedNote}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--color-stone-600)]">
                  Not yet completed
                </p>
                <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                  Complete a ten-minute reflection on your day.
                </p>
              </div>
              <Link
                href="/staff/closeout"
                className="text-xs font-medium text-[var(--color-blue-600)] hover:underline"
              >
                Close out →
              </Link>
            </div>
          )}
        </div>
      </Card>

      {/* Recent Recognition */}
      {recentActs.length > 0 ? (
        <Card>
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Recent Recognition ({recentActs.length})
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            {recentActs.map((act: RecognitionAct) => (
              <li
                key={act.id}
                className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--color-stone-900)]">
                      {act.narrative}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                      {formatDate(act.occurredOn, "en-US")}
                    </p>
                  </div>
                  <Badge tone="success" className="shrink-0">
                    {act.reviewState === "submitted"
                      ? "Pending"
                      : act.reviewState === "acknowledged"
                        ? "Seen"
                        : act.reviewState === "coached"
                          ? "Coached"
                          : "Dismissed"}
                  </Badge>
                </div>
                {act.coachingNote ? (
                  <p className="mt-2 text-xs text-[var(--color-stone-600)]">
                    Coaching: {act.coachingNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
