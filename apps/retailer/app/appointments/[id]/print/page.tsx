import {
  AppointmentRepository,
  ClientelingRepository,
  CustomerRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  asId,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from "@paon/domain";
import { formatDate } from "@paon/utils";
import { notFound } from "next/navigation";

import { PrintButton } from "../../../alterations/[id]/print/print-button";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * A one-page appointment brief a floor advisor can print (or export to
 * PDF) and carry into the fitting room — same "deliberately outside
 * `(dashboard)` so it renders with no sidebar chrome" shape as the
 * alteration work-order print pack, reusing its `PrintButton` rather
 * than duplicating it.
 */
export default async function AppointmentPrintPage({
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
  if (!appointment || appointment.retailerId !== session.retailerId) {
    notFound();
  }

  const [customer, staff, notes] = await Promise.all([
    new CustomerRepository(supabase).findById(appointment.customerId),
    new RetailerStaffRepository(supabase).findByRetailer(session.retailerId),
    new ClientelingRepository(supabase).findByCustomer(appointment.customerId),
  ]);
  const assignedAdvisor = staff.find(
    (member) => member.id === appointment.staffId,
  );
  const pinnedNote = notes.find((note) => note.pinned);

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a] print:min-h-0">
      <div className="mx-auto max-w-2xl px-8 py-10 print:max-w-none print:px-0 print:py-0">
        <div className="mb-6 flex justify-end print:hidden">
          <PrintButton />
        </div>

        <header className="flex items-start justify-between border-b-2 border-[#1a1a1a] pb-4">
          <div>
            <p className="font-accent text-xs uppercase tracking-[0.24em] text-[#1a1a1a]/60">
              PAON · Appointment brief
            </p>
            <h1 className="font-display mt-1 text-3xl leading-none">
              {customer?.fullName ?? "Customer"}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-[#1a1a1a]/60">
              {APPOINTMENT_TYPE_LABELS[appointment.type]}
            </p>
            <p className="text-lg font-medium">
              {formatDate(appointment.startsAt, "en-US")}
            </p>
            <p className="text-sm text-[#1a1a1a]/70">
              {new Date(appointment.startsAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#1a1a1a]/50">
              Customer
            </p>
            <p className="mt-1 text-base font-medium">
              {customer?.fullName ?? "Unknown customer"}
            </p>
            {customer?.phone ? (
              <p className="text-sm text-[#1a1a1a]/70">{customer.phone}</p>
            ) : null}
            {customer?.email ? (
              <p className="text-sm text-[#1a1a1a]/70">{customer.email}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#1a1a1a]/50">
              Advisor
            </p>
            <p className="mt-1 text-base font-medium">
              {assignedAdvisor?.fullName ?? "Unassigned"}
            </p>
            <p className="text-sm text-[#1a1a1a]/70">
              Status: {APPOINTMENT_STATUS_LABELS[appointment.status]}
            </p>
          </div>
        </section>

        {pinnedNote ? (
          <section className="mt-6 border-t border-[#1a1a1a]/15 pt-4">
            <h2 className="text-sm font-medium uppercase tracking-[0.1em]">
              Pinned client note
            </h2>
            <p className="mt-2 text-sm leading-6">{pinnedNote.body}</p>
          </section>
        ) : null}

        {appointment.notes ? (
          <section className="mt-6 border-t border-[#1a1a1a]/15 pt-4">
            <h2 className="text-sm font-medium uppercase tracking-[0.1em]">
              Appointment request
            </h2>
            <p className="mt-2 text-sm leading-6">{appointment.notes}</p>
          </section>
        ) : null}

        <footer className="mt-10 flex items-center justify-between border-t border-[#1a1a1a]/15 pt-4 text-xs text-[#1a1a1a]/50">
          <span>Printed {formatDate(new Date().toISOString(), "en-US")}</span>
          <span className="font-mono tracking-[0.2em]">{appointment.id}</span>
        </footer>
      </div>
    </div>
  );
}
