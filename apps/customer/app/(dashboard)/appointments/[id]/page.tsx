import { AppointmentRepository, RetailerRepository } from "@paon/database";
import {
  asId,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import { notFound } from "next/navigation";

import { AppointmentStatusBadge } from "../status-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const appointment = await new AppointmentRepository(supabase).findById(
    asId<"AppointmentId">(id),
  );
  if (!appointment) {
    notFound();
  }

  const retailer = await new RetailerRepository(supabase).findById(
    appointment.retailerId,
  );
  const formatTime = (iso: string) =>
    formatDate(iso, "en-US", { hour: "numeric", minute: "2-digit" });
  const isTerminal = ["canceled", "no_show"].includes(appointment.status);
  const progressStatuses = [
    "requested",
    "confirmed",
    "checked_in",
    "completed",
  ] as const;
  const currentProgress = progressStatuses.indexOf(
    appointment.status as (typeof progressStatuses)[number],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
            {retailer?.displayName ?? "Unknown retailer"}
          </h1>
          <AppointmentStatusBadge status={appointment.status} />
        </div>
        <p className="text-sm text-[var(--color-stone-500)]">
          {APPOINTMENT_TYPE_LABELS[appointment.type]}
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Appointment time
          </p>
          <p className="text-[var(--color-stone-900)]">
            {formatDate(appointment.startsAt, "en-US")}
          </p>
          <p className="text-sm text-[var(--color-stone-600)]">
            {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)}
          </p>
        </div>
        {appointment.notes ? (
          <div>
            <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
              Your notes
            </p>
            <p className="text-[var(--color-stone-900)]">{appointment.notes}</p>
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="font-display text-xl text-[var(--color-stone-900)]">
          Appointment status
        </h2>
        {isTerminal ? (
          <div className="mt-4 flex items-center gap-3 text-sm text-[var(--color-stone-700)]">
            <AppointmentStatusBadge status={appointment.status} />
            <span>This appointment is no longer active.</span>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-4 gap-2">
            {progressStatuses.map((status, index) => (
              <div key={status} className="flex flex-col gap-2">
                <div
                  className={`h-1.5 rounded-full ${index <= currentProgress ? "bg-[var(--color-stone-900)]" : "bg-[var(--color-stone-200)]"}`}
                />
                <span
                  className={`text-xs ${index === currentProgress ? "font-medium text-[var(--color-stone-900)]" : "text-[var(--color-stone-500)]"}`}
                >
                  {APPOINTMENT_STATUS_LABELS[status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {appointment.status === "requested" ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          We&rsquo;ll follow up to confirm this time.
        </p>
      ) : null}
    </div>
  );
}
