import {
  AlterationRepository,
  AlterationTaskRepository,
  CustomerRepository,
  PhysicalGarmentRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { asId, type Alteration, type StaffId } from "@paon/domain";
import { formatDate, formatMoney } from "@paon/utils";
import { notFound } from "next/navigation";

import { PrintButton } from "./print-button";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * The digital replacement for the paper "pompkaart" that used to travel
 * physically with a garment — printed (or exported to PDF via the
 * browser's own print dialog) and either handed to a workshop or kept
 * with the garment on the rail. Deliberately outside the `(dashboard)`
 * route group so it renders with no sidebar/chrome to print, and reuses
 * the exact same repositories as the alteration detail page — no
 * parallel data layer for what is fundamentally the same work order.
 */
export default async function AlterationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const isWorker = session.retailerRole === "worker";
  const alterationRepository = new AlterationRepository(supabase);
  const alteration = isWorker
    ? await alterationRepository.findByIdForWorker(asId<"AlterationId">(id))
    : await alterationRepository.findById(asId<"AlterationId">(id));
  if (!alteration) notFound();

  const fullAlteration =
    "customerId" in alteration ? (alteration as Alteration) : null;
  const workerAlteration = "garmentType" in alteration ? alteration : null;

  const taskRepository = new AlterationTaskRepository(supabase);
  const [customer, garment, tasks, taskNotes, staff, fitObservations] =
    await Promise.all([
      fullAlteration
        ? new CustomerRepository(supabase).findById(fullAlteration.customerId)
        : Promise.resolve(null),
      new PhysicalGarmentRepository(supabase).findById(
        alteration.physicalGarmentId,
      ),
      isWorker
        ? taskRepository.findByAlterationForWorker(alteration.id)
        : taskRepository.findByAlteration(alteration.id),
      taskRepository.findNotesByAlteration(alteration.id),
      isWorker
        ? new RetailerStaffRepository(supabase)
            .findByUserId(session.userId)
            .then((member) => (member ? [member] : []))
        : new RetailerStaffRepository(supabase).findByRetailer(
            session.retailerId,
          ),
      new PhysicalGarmentRepository(supabase).findObservationsByGarment(
        alteration.physicalGarmentId,
      ),
    ]);

  const staffName = (staffId?: StaffId): string =>
    staffId
      ? (staff.find((member) => member.id === staffId)?.fullName ??
        "Former staff member")
      : "System";

  const garmentLabel = workerAlteration
    ? `${workerAlteration.brand ? `${workerAlteration.brand} ` : ""}${workerAlteration.garmentType}`
    : `${garment?.brand ? `${garment.brand} ` : ""}${garment?.garmentType ?? "Garment"}`;

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a] print:min-h-0">
      <div className="mx-auto max-w-2xl px-8 py-10 print:max-w-none print:px-0 print:py-0">
        <div className="mb-6 flex justify-end print:hidden">
          <PrintButton />
        </div>

        <header className="flex items-start justify-between border-b-2 border-[#1a1a1a] pb-4">
          <div>
            <p className="font-accent text-xs uppercase tracking-[0.24em] text-[#1a1a1a]/60">
              PAON · Alteration work order
            </p>
            <h1 className="font-display mt-1 text-3xl leading-none">
              {alteration.workOrderNumber}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-[#1a1a1a]/60">
              Status
            </p>
            <p className="text-lg font-medium capitalize">
              {alteration.status.replaceAll("_", " ")}
            </p>
            {alteration.dueDate ? (
              <p className="mt-1 text-sm text-[#1a1a1a]/70">
                Due {formatDate(alteration.dueDate, "en-US")}
              </p>
            ) : null}
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#1a1a1a]/50">
              Customer
            </p>
            <p className="mt-1 text-base font-medium">
              {customer?.fullName ??
                (isWorker ? "Not shared with workshop" : "Customer")}
            </p>
            {!isWorker && customer?.phone ? (
              <p className="text-sm text-[#1a1a1a]/70">{customer.phone}</p>
            ) : null}
            {!isWorker && customer?.email ? (
              <p className="text-sm text-[#1a1a1a]/70">{customer.email}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#1a1a1a]/50">
              Garment
            </p>
            <p className="mt-1 text-base font-medium">{garmentLabel}</p>
            <p className="text-sm text-[#1a1a1a]/70">
              {workerAlteration
                ? workerAlteration.garmentDescription
                : (garment?.description ?? "Identification unavailable")}
            </p>
            <p className="text-sm text-[#1a1a1a]/70">
              Intake condition:{" "}
              {workerAlteration
                ? workerAlteration.intakeCondition
                : (garment?.intakeCondition ?? "—")}
            </p>
          </div>
        </section>

        {fullAlteration ? (
          <section className="mt-6 flex gap-8 border-t border-[#1a1a1a]/15 pt-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#1a1a1a]/50">
                Original quote
              </p>
              <p className="text-base font-medium">
                {formatMoney(fullAlteration.originalQuote, "en-US")}
              </p>
            </div>
            {fullAlteration.agreedTotal ? (
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#1a1a1a]/50">
                  Agreed total
                </p>
                <p className="text-base font-medium">
                  {formatMoney(fullAlteration.agreedTotal, "en-US")}
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {fitObservations.length > 0 ? (
          <section className="mt-6 border-t border-[#1a1a1a]/15 pt-4">
            <h2 className="text-sm font-medium uppercase tracking-[0.1em]">
              Fitting notes
            </h2>
            <div className="mt-2 divide-y divide-[#1a1a1a]/10">
              {fitObservations.map((observation) => (
                <div key={observation.id} className="py-2 text-sm">
                  <span className="font-medium">{observation.area}</span> —{" "}
                  {observation.observation}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-6 border-t border-[#1a1a1a]/15 pt-4">
          <h2 className="text-sm font-medium uppercase tracking-[0.1em]">
            Tasks
          </h2>
          <div className="mt-2 flex flex-col gap-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="break-inside-avoid rounded border border-[#1a1a1a]/15 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{task.title}</p>
                  <span className="text-xs uppercase text-[#1a1a1a]/60">
                    {task.classification.replaceAll("_", " ")} ·{" "}
                    {task.status.replaceAll("_", " ")}
                  </span>
                </div>
                {task.instructions ? (
                  <p className="mt-1 text-sm text-[#1a1a1a]/80">
                    {task.instructions}
                  </p>
                ) : null}
                {"originalQuote" in task ? (
                  <p className="mt-1 text-xs text-[#1a1a1a]/60">
                    Quote {formatMoney(task.originalQuote, "en-US")}
                    {task.agreedPrice
                      ? ` · Agreed ${formatMoney(task.agreedPrice, "en-US")}`
                      : ""}
                  </p>
                ) : null}
                {taskNotes
                  .filter((note) => note.taskId === task.id)
                  .map((note) => (
                    <p key={note.id} className="mt-1 text-sm text-[#1a1a1a]/70">
                      Note: {note.note}{" "}
                      <span className="text-xs text-[#1a1a1a]/50">
                        ({staffName(note.actorStaffId)},{" "}
                        {formatDate(note.createdAt, "en-US")})
                      </span>
                    </p>
                  ))}
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-10 flex items-center justify-between border-t border-[#1a1a1a]/15 pt-4 text-xs text-[#1a1a1a]/50">
          <span>Printed {formatDate(new Date().toISOString(), "en-US")}</span>
          <span className="font-mono tracking-[0.2em]">
            {alteration.workOrderNumber}
          </span>
        </footer>
      </div>
    </div>
  );
}
