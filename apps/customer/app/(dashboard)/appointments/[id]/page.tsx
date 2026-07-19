import { AppointmentRepository, RetailerRepository } from "@paon/database";
import { asId } from "@paon/domain";
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
            {retailer?.displayName ?? "Unknown retailer"}
          </h1>
          <AppointmentStatusBadge status={appointment.status} />
        </div>
        <p className="text-sm capitalize text-[var(--color-stone-500)]">
          {appointment.type.replaceAll("_", " ")}
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Requested time
          </p>
          <p className="text-[var(--color-stone-900)]">
            {formatDate(appointment.startsAt, "en-US")}
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

      {appointment.status === "requested" ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          We&rsquo;ll follow up to confirm this time.
        </p>
      ) : null}
    </div>
  );
}
