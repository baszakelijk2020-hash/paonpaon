import {
  AppointmentRepository,
  CustomerRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { asId, retailerRoleAtLeast } from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppointmentStatusBadge } from "../status-badge";

import { AppointmentActionsForm } from "./appointment-actions-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const appointment = await new AppointmentRepository(supabase).findById(
    asId<"AppointmentId">(id),
  );
  if (!appointment) {
    notFound();
  }

  const [customer, staff] = await Promise.all([
    new CustomerRepository(supabase).findById(appointment.customerId),
    new RetailerStaffRepository(supabase).findByRetailer(session.retailerId),
  ]);

  const canManage = retailerRoleAtLeast(
    session.retailerRole,
    "sales_associate",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
            {customer?.fullName ?? "Unknown customer"}
          </h1>
          <AppointmentStatusBadge status={appointment.status} />
        </div>
        <p className="text-sm capitalize text-[var(--color-stone-500)]">
          {appointment.type.replaceAll("_", " ")} ·{" "}
          {formatDate(appointment.startsAt, "en-US")}
        </p>
        {appointment.notes ? (
          <p className="mt-2 text-sm text-[var(--color-stone-700)]">
            {appointment.notes}
          </p>
        ) : null}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Customer profile
        </h2>
        <Card className="flex flex-col gap-3">
          {customer ? (
            <>
              <p className="text-sm text-[var(--color-stone-700)]">
                {customer.email ?? "No email on file"}
                {customer.phone ? ` · ${customer.phone}` : ""} ·{" "}
                <span className="capitalize">{customer.lifecycleStage}</span>
              </p>
              <p className="text-sm text-[var(--color-stone-500)]">
                Fit observations are recorded against the physical garment
                during alteration intake.
              </p>
              <Link
                href={`/customers/${customer.id}`}
                className="text-sm underline"
              >
                View full customer record
              </Link>
              {canManage ? (
                <Link
                  href={`/alterations/new?customerId=${customer.id}&appointmentId=${appointment.id}`}
                  className={buttonVariants({
                    variant: "secondary",
                    size: "sm",
                  })}
                >
                  Start garment intake
                </Link>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-[var(--color-stone-500)]">
              Customer record not found.
            </p>
          )}
        </Card>
      </div>

      {canManage ? (
        <AppointmentActionsForm
          appointmentId={appointment.id}
          currentStatus={appointment.status}
          {...(appointment.staffId
            ? { currentStaffId: appointment.staffId }
            : {})}
          staff={staff}
        />
      ) : null}
    </div>
  );
}
