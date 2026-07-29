"use client";

import { APPOINTMENT_TYPE_LABELS, type Appointment } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { SearchableCollection } from "@paon/ui/components/SearchableCollection";
import { formatDate } from "@paon/utils";
import Link from "next/link";
import { useState, useTransition } from "react";

import {
  bulkCompleteAppointments,
  quickUpdateAppointmentStatus,
} from "./actions";
import { AppointmentStatusBadge } from "./status-badge";

const QUICK_STATUSES = [
  "requested",
  "confirmed",
  "checked_in",
  "completed",
  "canceled",
  "no_show",
] as const;

const STATUS_OPTION_LABELS: Record<(typeof QUICK_STATUSES)[number], string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  canceled: "Canceled",
  no_show: "No-show",
};

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/** High 16 mitigation: a day heading above each run of same-day rows —
 * not a calendar rebuild, just orientation on top of the list the
 * repository already returns sorted by `starts_at`. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const diffDays = Math.round(
    (startOfDay(date) - startOfDay(new Date())) / 86_400_000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function AppointmentsList({
  appointments,
  customerNameById,
}: {
  appointments: Appointment[];
  customerNameById: Record<string, string>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function markSelectedCompleted() {
    const formData = new FormData();
    for (const id of selected) formData.append("appointmentIds", id);
    startTransition(async () => {
      await bulkCompleteAppointments(formData);
      setSelected(new Set());
    });
  }

  return (
    <SearchableCollection
      items={appointments}
      placeholder="Search client or appointment type…"
      label="Search appointments"
      predicate={(appointment, query) => {
        const name = (
          customerNameById[appointment.customerId] ?? ""
        ).toLowerCase();
        return (
          name.includes(query) ||
          appointment.type.replaceAll("_", " ").toLowerCase().includes(query) ||
          appointment.status.replaceAll("_", " ").toLowerCase().includes(query)
        );
      }}
      empty={
        <p className="text-sm text-[var(--color-stone-500)]">
          No appointments match that search.
        </p>
      }
    >
      {(filtered) => {
        const groups: Array<{ label: string; appointments: Appointment[] }> =
          [];
        for (const appointment of filtered) {
          const label = dayLabel(appointment.startsAt);
          const currentGroup = groups[groups.length - 1];
          if (currentGroup && currentGroup.label === label) {
            currentGroup.appointments.push(appointment);
          } else {
            groups.push({ label, appointments: [appointment] });
          }
        }

        return (
          <div className="flex flex-col gap-6">
            {selected.size > 0 ? (
              <div className="paon-reveal sticky top-0 z-10 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-4 py-3 shadow-[var(--shadow-lifted)]">
                <p className="text-sm text-[var(--color-stone-700)]">
                  {selected.size} selected
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={markSelectedCompleted}
                >
                  {isPending ? "Marking…" : "Mark completed"}
                </Button>
              </div>
            ) : null}
            {groups.map((group) => (
              <div key={`${group.label}-${group.appointments[0]!.id}`}>
                <p className="font-accent mb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
                  {group.label}
                </p>
                <Card className="paon-reveal divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-elevated)]">
                  {group.appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        {appointment.status !== "completed" &&
                        appointment.status !== "canceled" ? (
                          <input
                            type="checkbox"
                            aria-label={`Select ${customerNameById[appointment.customerId] ?? "appointment"}`}
                            checked={selected.has(appointment.id)}
                            onChange={() => toggle(appointment.id)}
                            className="mt-1.5 h-4 w-4 shrink-0"
                          />
                        ) : (
                          <span className="mt-1.5 h-4 w-4 shrink-0" />
                        )}
                        <Link
                          href={`/appointments/${appointment.id}`}
                          className="min-w-0 hover:underline"
                        >
                          <p className="font-medium text-[var(--color-stone-900)]">
                            {customerNameById[appointment.customerId] ??
                              "Unknown client"}
                          </p>
                          <p className="text-sm text-[var(--color-stone-500)]">
                            {APPOINTMENT_TYPE_LABELS[appointment.type]} ·{" "}
                            {formatDate(appointment.startsAt, "en-US")}
                          </p>
                        </Link>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <AppointmentStatusBadge status={appointment.status} />
                        <form
                          action={quickUpdateAppointmentStatus}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="appointmentId"
                            value={appointment.id}
                          />
                          <select
                            name="status"
                            defaultValue={appointment.status}
                            aria-label="Appointment status"
                            className="h-9 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-2 text-xs"
                          >
                            {QUICK_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {STATUS_OPTION_LABELS[status]}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="h-9 rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-3 text-xs text-white"
                          >
                            Update
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            ))}
          </div>
        );
      }}
    </SearchableCollection>
  );
}
