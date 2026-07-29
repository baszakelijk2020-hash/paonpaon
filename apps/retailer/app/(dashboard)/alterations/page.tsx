import {
  AlterationRepository,
  CustomerRepository,
  PhysicalGarmentRepository,
} from "@paon/database";
import {
  retailerRoleHasAlterationsPermission,
  type Alteration,
  type AlterationStatus,
} from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { AlterationStatusBadge } from "./status-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const STATUS_PROGRESS: Record<AlterationStatus, number> = {
  intake: 8,
  quoted: 16,
  awaiting_approval: 24,
  approved: 34,
  assigned: 45,
  in_progress: 62,
  completion_review: 78,
  ready_for_pickup: 90,
  out_for_delivery: 94,
  completed: 100,
  canceled: 100,
};

function isDueSoon(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  const distance = new Date(dueDate).getTime() - Date.now();
  return distance <= 3 * 24 * 60 * 60 * 1000;
}

export default async function AlterationsPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const isWorker = session.retailerRole === "worker";
  const alterationRepository = new AlterationRepository(supabase);
  const alterations = isWorker
    ? await alterationRepository.findAssignedToWorker()
    : await alterationRepository.findByRetailer(session.retailerId);
  const customers = isWorker
    ? []
    : await new CustomerRepository(supabase).findByRetailer(session.retailerId);
  const customerNameById = new Map(
    customers.map((customer) => [customer.id, customer.fullName]),
  );
  const garments = isWorker
    ? []
    : await Promise.all(
        alterations.map((alteration) =>
          new PhysicalGarmentRepository(supabase).findById(
            alteration.physicalGarmentId,
          ),
        ),
      );
  const garmentById = new Map(
    garments
      .filter((garment) => garment !== null)
      .map((garment) => [garment.id, garment]),
  );
  const active = alterations.filter(
    (alteration) => !["completed", "canceled"].includes(alteration.status),
  );
  const dueSoon = active.filter((alteration) => isDueSoon(alteration.dueDate));
  const inProgress = active.filter((alteration) =>
    ["in_progress", "completion_review"].includes(alteration.status),
  );
  const isWorkshopPersona = ["workshop_manager", "worker"].includes(
    session.retailerRole,
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="relative isolate overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-stone-900)] p-7 text-white shadow-[var(--shadow-elevated)] sm:p-10">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 -z-10 w-1/2 bg-[repeating-linear-gradient(135deg,transparent,transparent_18px,rgba(255,255,255,0.035)_18px,rgba(255,255,255,0.035)_19px)]"
        />
        <p className="font-accent text-[11px] uppercase tracking-[0.22em] text-white/60">
          {isWorkshopPersona ? "Workshop floor" : "Fitting to finish"}
        </p>
        <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="font-display text-3xl leading-none sm:text-4xl">
              {session.retailerRole === "worker"
                ? "Your workbench."
                : session.retailerRole === "workshop_manager"
                  ? "The workroom, clearly."
                  : "Every garment has a story."}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/65">
              {session.retailerRole === "worker"
                ? "Only garments assigned to you are shown. Open one to see the approved work and next handoff."
                : "Move each garment from fitting observation to skilled work, quality review and a confident client handoff."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {retailerRoleHasAlterationsPermission(
              session.retailerRole,
              "intake",
            ) ? (
              <Link
                href="/alterations/new"
                className={buttonVariants({
                  variant: "secondary",
                  size: "lg",
                })}
              >
                Begin a fitting intake
              </Link>
            ) : null}
            {session.retailerRole === "workshop_manager" ? (
              <Link
                href="/alterations/catalogue"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "border-white/30 text-white hover:bg-white/10",
                })}
              >
                Workshop services
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white shadow-[var(--shadow-lifted)]">
        {[
          { value: active.length, label: "Active garments" },
          { value: dueSoon.length, label: "Due within 3 days" },
          { value: inProgress.length, label: "On the workbench" },
        ].map((metric) => (
          <div
            key={metric.label}
            className="border-r border-[var(--color-stone-200)] p-5 last:border-r-0 sm:p-6"
          >
            <p className="font-display text-4xl">{metric.value}</p>
            <p className="mt-1 text-xs text-[var(--color-stone-500)]">
              {metric.label}
            </p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
              {isWorkshopPersona ? "Priority queue" : "Garment journeys"}
            </p>
            <h2 className="font-display text-4xl">What moves next</h2>
          </div>
          <p className="text-sm text-[var(--color-stone-500)]">
            {alterations.length} total
          </p>
        </div>

        {alterations.length === 0 ? (
          <Card className="border-dashed py-14 text-center">
            <p className="font-display text-3xl">The workbench is clear.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--color-stone-500)]">
              {session.retailerRole === "worker"
                ? "When a workshop manager assigns approved work to you, the garment and its instructions will appear here."
                : "Start with a fitting intake to capture the garment, observations, quote and work that can begin immediately."}
            </p>
            {retailerRoleHasAlterationsPermission(
              session.retailerRole,
              "intake",
            ) ? (
              <Link
                href="/alterations/new"
                className={buttonVariants({ className: "mt-5" })}
              >
                Create first work order
              </Link>
            ) : null}
          </Card>
        ) : (
          <div className="grid gap-4">
            {alterations.map((alteration) => {
              const garment = garmentById.get(alteration.physicalGarmentId);
              const customerName =
                "customerId" in alteration
                  ? (customerNameById.get(
                      (alteration as Alteration).customerId,
                    ) ?? "Customer")
                  : "Assigned garment";
              return (
                <Link
                  key={alteration.id}
                  href={`/alterations/${alteration.id}`}
                  className="group"
                >
                  <Card className="overflow-hidden rounded-[var(--radius-md)] p-0 transition-transform duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lifted)]">
                    <div className="grid items-center gap-5 p-5 sm:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.7fr)_auto] sm:p-6">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-display text-2xl">
                            {customerName}
                          </p>
                          {isDueSoon(alteration.dueDate) ? (
                            <span className="bg-[var(--color-warning-500)]/20 rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide">
                              Due soon
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                          {alteration.workOrderNumber} ·{" "}
                          {"garmentType" in alteration
                            ? `${alteration.brand ? `${alteration.brand} ` : ""}${alteration.garmentType}`
                            : `${garment?.brand ? `${garment.brand} ` : ""}${garment?.garmentType ?? "Garment"}`}
                        </p>
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                          <span className="capitalize text-[var(--color-stone-600)]">
                            {alteration.status.replaceAll("_", " ")}
                          </span>
                          <span className="text-[var(--color-stone-400)]">
                            {alteration.dueDate
                              ? `Due ${formatDate(alteration.dueDate, "en-US")}`
                              : "Due date open"}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-stone-100)]">
                          <div
                            className="h-full rounded-full bg-[var(--color-stone-900)] transition-[width] duration-500"
                            style={{
                              width: `${STATUS_PROGRESS[alteration.status]}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <AlterationStatusBadge status={alteration.status} />
                        <span aria-hidden="true">→</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
