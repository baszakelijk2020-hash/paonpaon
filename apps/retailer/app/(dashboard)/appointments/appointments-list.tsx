"use client";

import type { Appointment } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { SearchableCollection } from "@paon/ui/components/SearchableCollection";
import { formatDate, humaniseStatus } from "@paon/utils";
import Link from "next/link";

import { quickUpdateAppointmentStatus } from "./actions";
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

export function AppointmentsList({
  appointments,
  customerNameById,
}: {
  appointments: Appointment[];
  customerNameById: Record<string, string>;
}) {
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
      {(filtered) => (
        <Card className="paon-reveal divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-elevated)]">
          {filtered.map((appointment) => (
            <div
              key={appointment.id}
              className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <Link
                href={`/appointments/${appointment.id}`}
                className="min-w-0 hover:underline"
              >
                <p className="font-medium text-[var(--color-stone-900)]">
                  {customerNameById[appointment.customerId] ?? "Unknown client"}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {humaniseStatus(appointment.type)} ·{" "}
                  {formatDate(appointment.startsAt, "en-US")}
                </p>
              </Link>
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
      )}
    </SearchableCollection>
  );
}
