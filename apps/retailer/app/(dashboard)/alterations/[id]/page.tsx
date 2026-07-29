import {
  AlterationRepository,
  AlterationAttachmentRepository,
  AlterationHandoffRepository,
  AlterationTaskRepository,
  AlterationUpdateRepository,
  AlterationWorkflowRepository,
  CustomerRepository,
  PhysicalGarmentRepository,
  RetailerStaffRepository,
  WorkshopRepository,
} from "@paon/database";
import {
  ALTERATION_STATUS_TRANSITIONS,
  ALTERATION_TASK_STATUS_LABELS,
  CUSTODY_EVENT_TYPE_LABELS,
  PRICING_EVENT_TYPE_LABELS,
  WORK_CLASSIFICATION_LABELS,
  asId,
  canRetailerRoleTransitionAlteration,
  retailerRoleHasAlterationsPermission,
  type Alteration,
  type StaffId,
} from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Image from "next/image";
import { notFound } from "next/navigation";

import { AlterationStatusBadge } from "../status-badge";

import {
  addTaskNote,
  assignWorkOrder,
  recordCustodyEvent,
  recordFitToolObservation,
  recordFulfillment,
  updateTaskStatus,
  updateWorkshopAssignment,
  uploadAlterationPhoto,
} from "./actions";
import { PriceDecisionForm, PriceProposalForm } from "./pricing-actions";
import { UpdateForm } from "./update-form";
import { WorkflowActionForm } from "./workflow-action-form";

import { FitToolPanel } from "@/components/fit-tools/fit-tool-panel";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AlterationDetailPage({
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
  if (!alteration) {
    notFound();
  }
  const fullAlteration =
    "customerId" in alteration ? (alteration as Alteration) : null;
  const workerAlteration = "garmentType" in alteration ? alteration : null;

  const handoffRepository = new AlterationHandoffRepository(supabase);
  const taskRepository = new AlterationTaskRepository(supabase);
  const workflowRepository = new AlterationWorkflowRepository(supabase);
  const [
    customer,
    garment,
    tasks,
    taskNotes,
    updates,
    proposals,
    workshops,
    staff,
    custody,
    fulfillment,
    assignment,
    attachments,
    pricingHistory,
    completionReviews,
    fitObservations,
  ] = await Promise.all([
    fullAlteration
      ? new CustomerRepository(supabase).findById(fullAlteration.customerId)
      : Promise.resolve(null),
    isWorker
      ? Promise.resolve(null)
      : new PhysicalGarmentRepository(supabase).findById(
          alteration.physicalGarmentId,
        ),
    isWorker
      ? taskRepository.findByAlterationForWorker(alteration.id)
      : taskRepository.findByAlteration(alteration.id),
    taskRepository.findNotesByAlteration(alteration.id),
    isWorker
      ? Promise.resolve([])
      : new AlterationUpdateRepository(supabase).findByAlteration(
          alteration.id,
        ),
    isWorker
      ? Promise.resolve([])
      : workflowRepository.findPriceProposals(alteration.id),
    isWorker
      ? Promise.resolve([])
      : new WorkshopRepository(supabase).findByRetailer(session.retailerId),
    isWorker
      ? new RetailerStaffRepository(supabase)
          .findByUserId(session.userId)
          .then((member) => (member ? [member] : []))
      : new RetailerStaffRepository(supabase).findByRetailer(
          session.retailerId,
        ),
    isWorker
      ? Promise.resolve([])
      : handoffRepository.findCustody(alteration.id),
    isWorker
      ? Promise.resolve([])
      : handoffRepository.findFulfillment(alteration.id),
    isWorker
      ? Promise.resolve(null)
      : workflowRepository.findActiveAssignment(alteration.id),
    new AlterationAttachmentRepository(supabase).findByAlteration(
      alteration.id,
    ),
    isWorker
      ? Promise.resolve([])
      : workflowRepository.findPricingHistory(alteration.id),
    isWorker
      ? Promise.resolve([])
      : workflowRepository.findCompletionReviews(alteration.id),
    isWorker
      ? Promise.resolve([])
      : new PhysicalGarmentRepository(supabase).findObservationsByGarment(
          alteration.physicalGarmentId,
        ),
  ]);
  const staffName = (staffId?: StaffId): string =>
    staffId
      ? (staff.find((member) => member.id === staffId)?.fullName ??
        "Former staff member")
      : "System";

  const hasUpdatePermission = [
    "intake",
    "oversight",
    "manage_assigned_workshop",
    "work_assigned_tasks",
  ].some((permission) =>
    retailerRoleHasAlterationsPermission(
      session.retailerRole,
      permission as Parameters<typeof retailerRoleHasAlterationsPermission>[1],
    ),
  );
  const canAddUpdate =
    hasUpdatePermission &&
    ALTERATION_STATUS_TRANSITIONS[alteration.status].some(
      (status) =>
        status !== "assigned" &&
        canRetailerRoleTransitionAlteration(
          session.retailerRole,
          alteration.status,
          status,
        ),
    );
  const canProposePrice = retailerRoleHasAlterationsPermission(
    session.retailerRole,
    "manage_assigned_workshop",
  );
  const canApprovePrice = retailerRoleHasAlterationsPermission(
    session.retailerRole,
    "approve_pricing",
  );
  const canSeePricing = !isWorker;
  const canAssign = retailerRoleHasAlterationsPermission(
    session.retailerRole,
    "configure",
  );
  const canManageWorkshopAssignment = retailerRoleHasAlterationsPermission(
    session.retailerRole,
    "manage_assigned_workshop",
  );
  const canWorkTasks = [
    "oversight",
    "manage_assigned_workshop",
    "work_assigned_tasks",
  ].some((permission) =>
    retailerRoleHasAlterationsPermission(
      session.retailerRole,
      permission as Parameters<typeof retailerRoleHasAlterationsPermission>[1],
    ),
  );
  const canHandoff = ["intake", "oversight", "manage_assigned_workshop"].some(
    (permission) =>
      retailerRoleHasAlterationsPermission(
        session.retailerRole,
        permission as Parameters<
          typeof retailerRoleHasAlterationsPermission
        >[1],
      ),
  );
  const canFulfill =
    retailerRoleHasAlterationsPermission(session.retailerRole, "intake") ||
    retailerRoleHasAlterationsPermission(session.retailerRole, "oversight");
  const canUploadEvidence = [
    "intake",
    "oversight",
    "manage_assigned_workshop",
    "work_assigned_tasks",
  ].some((permission) =>
    retailerRoleHasAlterationsPermission(
      session.retailerRole,
      permission as Parameters<typeof retailerRoleHasAlterationsPermission>[1],
    ),
  );
  const custodyEventOptions =
    session.retailerRole === "workshop_manager"
      ? [
          ["handed_to_workshop", "Received by workshop"],
          ["returned_to_retailer", "Returned to retailer"],
        ]
      : [
          ["handed_to_workshop", "Handed to workshop"],
          ["returned_to_retailer", "Returned to retailer"],
          ["released_to_customer", "Released to customer"],
          ["delivery_dispatch", "Delivery dispatch"],
          ["delivery_complete", "Delivery complete"],
        ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
              {customer?.fullName ??
                (isWorker ? "Assigned garment" : "Customer")}
            </h1>
            <AlterationStatusBadge status={alteration.status} />
          </div>
          <a
            href={`/alterations/${alteration.id}/print`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-stone-300)] px-4 py-2 text-sm text-[var(--color-stone-700)] hover:border-[var(--color-stone-500)]"
          >
            Print / export card
          </a>
        </div>
        <p className="text-sm text-[var(--color-stone-500)]">
          {alteration.workOrderNumber} ·{" "}
          {workerAlteration
            ? `${workerAlteration.brand ? `${workerAlteration.brand} ` : ""}${workerAlteration.garmentType}`
            : `${garment?.brand ? `${garment.brand} ` : ""}${garment?.garmentType ?? "Garment"}`}
        </p>
        {alteration.dueDate ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            Due {formatDate(alteration.dueDate, "en-US")}
          </p>
        ) : null}
      </div>

      {canSeePricing ? (
        <div id="pricing">
          <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
            Pricing proposals
          </h2>
          <Card className="flex flex-col gap-4">
            {proposals.length === 0 ? (
              <p className="text-sm text-[var(--color-stone-500)]">
                No workshop price changes proposed. The original quote remains
                preserved.
              </p>
            ) : (
              proposals.map((proposal) => (
                <div
                  key={proposal.id}
                  className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
                >
                  <p className="font-medium">
                    {(
                      {
                        pending: "Pending",
                        approved: "Approved",
                        rejected: "Rejected",
                        withdrawn: "Withdrawn",
                      } as Record<string, string>
                    )[proposal.status] ?? proposal.status}{" "}
                    · {proposal.originalAmount.amountMinorUnits / 100} →{" "}
                    {proposal.proposedAmount.amountMinorUnits / 100}{" "}
                    {proposal.proposedAmount.currency}
                  </p>
                  <p className="text-sm text-[var(--color-stone-700)]">
                    {proposal.explanation}
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    Proposed by {staffName(proposal.proposedByStaffId)} ·{" "}
                    {formatDate(proposal.createdAt, "en-US")}
                  </p>
                  {proposal.evidenceAttachmentId
                    ? attachments
                        .filter(
                          ({ attachment }) =>
                            attachment.id === proposal.evidenceAttachmentId,
                        )
                        .map(({ attachment, signedUrl }) => (
                          <a
                            key={attachment.id}
                            href={signedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm underline"
                          >
                            Evidence: {attachment.fileName}
                          </a>
                        ))
                    : null}
                  {proposal.decisionReason ? (
                    <>
                      <p className="text-sm">
                        Decision: {proposal.decisionReason}
                      </p>
                      <p className="text-xs text-[var(--color-stone-500)]">
                        Decided by {staffName(proposal.decidedByStaffId)}
                        {proposal.decidedAt
                          ? ` · ${formatDate(proposal.decidedAt, "en-US")}`
                          : ""}
                      </p>
                    </>
                  ) : null}
                  {canApprovePrice && proposal.status === "pending" ? (
                    <PriceDecisionForm
                      alterationId={alteration.id}
                      proposal={proposal}
                    />
                  ) : null}
                </div>
              ))
            )}
            {canProposePrice ? (
              <PriceProposalForm
                alterationId={alteration.id}
                tasks={tasks.filter((task) => "originalQuote" in task)}
                evidence={attachments.map(({ attachment }) => attachment)}
              />
            ) : null}
          </Card>

          {pricingHistory.length > 0 ? (
            <Card>
              <h2 className="mb-3 text-lg font-medium">Pricing audit trail</h2>
              <p className="mb-3 text-sm text-[var(--color-stone-500)]">
                Every quote, proposal, approval and rejection, in order —
                append-only, cross-check this against the workshop&rsquo;s
                invoice.
              </p>
              <div className="divide-y divide-[var(--color-stone-100)]">
                {pricingHistory.map((entry) => (
                  <div key={entry.id} className="py-2 text-sm">
                    <span className="font-medium">
                      {PRICING_EVENT_TYPE_LABELS[entry.eventType]}
                    </span>{" "}
                    · {(entry.amount.amountMinorUnits / 100).toFixed(2)}{" "}
                    {entry.amount.currency}
                    {" · "}
                    {staffName(entry.actorStaffId)}
                    {" · "}
                    {formatDate(entry.createdAt, "en-US")}
                    {entry.reason ? (
                      <p className="text-[var(--color-stone-600)]">
                        {entry.reason}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-medium">Chain of custody</h2>
        <Card className="flex flex-col gap-3">
          {custody.map((event) => (
            <div key={event.id}>
              <p className="text-sm font-medium">
                {CUSTODY_EVENT_TYPE_LABELS[event.eventType]} ·{" "}
                {formatDate(event.occurredAt, "en-US")}
              </p>
              <p className="text-sm text-[var(--color-stone-500)]">
                {event.fromParty ?? "—"} → {event.toParty ?? "—"}
                {event.conditionNote ? ` · ${event.conditionNote}` : ""}
              </p>
              <p className="text-xs text-[var(--color-stone-500)]">
                Recorded by {staffName(event.actorStaffId)}
              </p>
            </div>
          ))}
          {canHandoff ? (
            <WorkflowActionForm
              action={recordCustodyEvent.bind(null, alteration.id)}
              className="grid grid-cols-1 gap-2 sm:grid-cols-4"
              submitLabel="Record handoff"
              pendingLabel="Recording…"
            >
              <select
                name="eventType"
                aria-label="Custody event"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 text-sm"
              >
                {custodyEventOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                name="fromParty"
                aria-label="Custody from party"
                placeholder="From"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-sm"
              />
              <input
                name="toParty"
                aria-label="Custody to party"
                placeholder="To"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-sm"
              />
              <input
                name="conditionNote"
                aria-label="Custody condition or verification note"
                placeholder="Condition / verification note"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-sm sm:col-span-4"
              />
            </WorkflowActionForm>
          ) : null}
        </Card>
      </div>

      {canFulfill ? (
        <div>
          <h2 className="mb-3 text-lg font-medium">Pickup or delivery</h2>
          <Card>
            {fulfillment.length ? (
              <div className="mb-4 divide-y divide-[var(--color-stone-100)]">
                {fulfillment.map((event) => (
                  <div key={event.id} className="py-2 text-sm">
                    <p className="font-medium">
                      {event.method === "pickup" ? "Pick-up" : "Delivery"} ·{" "}
                      {{
                        scheduled: "Scheduled",
                        ready: "Ready",
                        dispatched: "Dispatched",
                        completed: "Completed",
                        canceled: "Cancelled",
                      }[event.status] ?? event.status}
                    </p>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      Recorded by {staffName(event.actorStaffId)} ·{" "}
                      {formatDate(event.createdAt, "en-US")}
                    </p>
                    {event.releasedToName ? (
                      <p className="text-[var(--color-stone-600)]">
                        Released to {event.releasedToName}
                        {event.verificationNote
                          ? ` · ${event.verificationNote}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-sm text-[var(--color-stone-500)]">
                No pickup or delivery arrangement yet.
              </p>
            )}
            <WorkflowActionForm
              action={recordFulfillment.bind(null, alteration.id)}
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
              submitLabel="Record pickup / delivery"
              pendingLabel="Recording…"
            >
              <select
                name="method"
                aria-label="Fulfillment method"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 text-sm"
              >
                <option value="pickup">Pickup</option>
                <option value="delivery">Delivery</option>
              </select>
              <select
                name="fulfillmentStatus"
                aria-label="Fulfillment status"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 text-sm"
              >
                <option value="scheduled">Scheduled</option>
                <option value="ready">Ready</option>
                <option value="dispatched">Dispatched</option>
                <option value="completed">Completed</option>
                <option value="canceled">Canceled</option>
              </select>
              <input
                name="scheduledAt"
                type="datetime-local"
                aria-label="Scheduled date and time"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 text-sm"
              />
              <input
                name="deliveryLine1"
                aria-label="Delivery address line 1"
                placeholder="Delivery address line 1"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-sm sm:col-span-2"
              />
              <input
                name="deliveryLine2"
                aria-label="Delivery address line 2"
                placeholder="Address line 2 (optional)"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-sm"
              />
              <input
                name="deliveryCity"
                aria-label="Delivery city"
                placeholder="City"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-sm"
              />
              <input
                name="deliveryRegion"
                aria-label="Delivery region"
                placeholder="Region (optional)"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-sm"
              />
              <input
                name="deliveryPostalCode"
                aria-label="Delivery postal code"
                placeholder="Postal code"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-sm"
              />
              <input
                name="deliveryCountryCode"
                aria-label="Delivery country code"
                placeholder="Country code"
                minLength={2}
                maxLength={2}
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-sm"
              />
              <input
                name="releasedToName"
                aria-label="Released to"
                placeholder="Released to"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-sm"
              />
              <input
                name="verificationNote"
                aria-label="Fulfillment verification note"
                placeholder="Verification note"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-sm sm:col-span-2"
              />
            </WorkflowActionForm>
          </Card>
        </div>
      ) : null}

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-[var(--color-stone-500)]">
            Garment
          </p>
          <p>
            {workerAlteration
              ? workerAlteration.garmentDescription
              : (garment?.description ?? "Identification unavailable")}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--color-stone-500)]">
            Intake condition
          </p>
          <p>
            {workerAlteration
              ? workerAlteration.intakeCondition
              : (garment?.intakeCondition ?? "—")}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-[var(--color-stone-500)]">
            Original quote
          </p>
          {fullAlteration ? (
            <p>
              {fullAlteration.originalQuote.amountMinorUnits / 100}{" "}
              {fullAlteration.originalQuote.currency}
            </p>
          ) : (
            <p>Available to workshop management</p>
          )}
          {fullAlteration?.agreedTotal ? (
            <p className="text-sm text-[var(--color-success-500)]">
              Agreed {fullAlteration.agreedTotal.amountMinorUnits / 100}{" "}
              {fullAlteration.agreedTotal.currency}
            </p>
          ) : null}
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-medium">Photos & evidence</h2>
        <Card className="flex flex-col gap-4">
          {attachments.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {attachments.map(({ attachment, signedUrl }) => (
                <a
                  key={attachment.id}
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-stone-200)]"
                >
                  <Image
                    src={signedUrl}
                    alt={`${attachment.kind}: ${attachment.fileName}`}
                    width={320}
                    height={320}
                    unoptimized
                    className="aspect-square w-full object-cover"
                  />
                  <p className="truncate px-2 py-1 text-xs">
                    {attachment.kind} · {attachment.fileName}
                  </p>
                  <p className="truncate px-2 pb-2 text-xs text-[var(--color-stone-500)]">
                    {staffName(attachment.uploadedByStaffId)} ·{" "}
                    {formatDate(attachment.createdAt, "en-US")}
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-stone-500)]">
              No evidence images yet.
            </p>
          )}
          {canUploadEvidence ? (
            <WorkflowActionForm
              action={uploadAlterationPhoto.bind(null, alteration.id)}
              className="grid grid-cols-1 gap-2 sm:grid-cols-4"
              submitLabel="Upload image"
              pendingLabel="Uploading…"
              buttonClassName="sm:col-span-4"
            >
              <input
                name="photo"
                type="file"
                aria-label="Evidence image"
                accept="image/jpeg,image/png,image/webp"
                required
                className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 py-2 text-sm sm:col-span-2"
              />
              <select
                name="attachmentKind"
                aria-label="Evidence kind"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 text-sm"
              >
                {session.retailerRole !== "worker" ? (
                  <option value="intake">Intake</option>
                ) : null}
                <option value="evidence">Evidence</option>
                <option value="progress">Progress</option>
                <option value="completion">Completion</option>
              </select>
              <select
                name="attachmentTaskId"
                aria-label="Evidence task"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 text-sm"
              >
                <option value="">Whole work order</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </WorkflowActionForm>
          ) : null}
        </Card>
      </div>

      {canUploadEvidence && !isWorker ? (
        <div>
          <h2 className="mb-3 text-lg font-medium">Fit tools</h2>
          <Card className="flex flex-col gap-4">
            <FitToolPanel
              recordObservation={recordFitToolObservation.bind(
                null,
                alteration.id,
                alteration.physicalGarmentId,
              )}
            />
            {fitObservations.length > 0 ? (
              <div className="divide-y divide-[var(--color-stone-100)] border-t border-[var(--color-stone-100)] pt-3">
                {fitObservations.map((observation) => (
                  <div key={observation.id} className="py-2 text-sm">
                    <span className="font-medium">{observation.area}</span> ·{" "}
                    {observation.observation}
                    <span className="block text-xs text-[var(--color-stone-500)]">
                      {staffName(observation.recordedByStaffId)} ·{" "}
                      {formatDate(observation.createdAt, "en-US")}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {canAssign && alteration.status === "approved" ? (
        <Card>
          <h2 className="mb-3 text-lg font-medium">Assign workshop</h2>
          <WorkflowActionForm
            action={assignWorkOrder.bind(null, alteration.id)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            submitLabel="Assign"
            pendingLabel="Assigning…"
          >
            <select
              name="workshopId"
              aria-label="Workshop"
              required
              className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-3 text-sm"
            >
              <option value="">Choose workshop</option>
              {workshops.map((workshop) => (
                <option key={workshop.id} value={workshop.id}>
                  {workshop.name}
                </option>
              ))}
            </select>
            <input
              name="targetCompletionDate"
              type="date"
              aria-label="Target completion date"
              className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-3 text-sm"
            />
          </WorkflowActionForm>
        </Card>
      ) : null}

      {canManageWorkshopAssignment && assignment ? (
        <Card>
          <h2 className="mb-3 text-lg font-medium">Workshop assignment</h2>
          <WorkflowActionForm
            action={updateWorkshopAssignment.bind(null, alteration.id)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            submitLabel="Update worker & date"
            pendingLabel="Updating…"
          >
            <select
              name="workerId"
              aria-label="Assigned worker"
              defaultValue={assignment.assigned_worker_id ?? ""}
              className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-3 text-sm"
            >
              <option value="">Unassigned worker</option>
              {staff
                .filter(
                  (member) =>
                    member.role === "worker" && member.acceptedAt !== undefined,
                )
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
            </select>
            <input
              name="targetCompletionDate"
              type="date"
              aria-label="Target completion date"
              defaultValue={assignment.target_completion_date ?? ""}
              className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-3 text-sm"
            />
          </WorkflowActionForm>
        </Card>
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Tasks
        </h2>
        <Card className="divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-elevated)]">
          {tasks.map((task) => (
            <div key={task.id} className="px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{task.title}</p>
                <span className="text-xs uppercase text-[var(--color-stone-500)]">
                  {WORK_CLASSIFICATION_LABELS[task.classification]} ·{" "}
                  {ALTERATION_TASK_STATUS_LABELS[task.status]}
                </span>
              </div>
              {task.instructions ? (
                <p className="text-sm text-[var(--color-stone-700)]">
                  {task.instructions}
                </p>
              ) : null}
              {"originalQuote" in task ? (
                <p className="text-xs text-[var(--color-stone-500)]">
                  Original quote {task.originalQuote.amountMinorUnits / 100}{" "}
                  {task.originalQuote.currency}
                </p>
              ) : null}
              {taskNotes
                .filter((note) => note.taskId === task.id)
                .map((note) => (
                  <p
                    key={note.id}
                    className="mt-1 text-sm text-[var(--color-stone-600)]"
                  >
                    Work note: {note.note}
                    <span className="block text-xs text-[var(--color-stone-500)]">
                      {staffName(note.actorStaffId)} ·{" "}
                      {formatDate(note.createdAt, "en-US")}
                    </span>
                  </p>
                ))}
              {canWorkTasks && task.classification === "work_now" ? (
                <div className="mt-3 flex flex-col gap-2">
                  <WorkflowActionForm
                    action={updateTaskStatus.bind(null, task.id, alteration.id)}
                    className="flex flex-wrap gap-2"
                    submitLabel="Update task"
                    pendingLabel="Updating…"
                  >
                    <select
                      name="taskStatus"
                      aria-label={`${task.title} status`}
                      className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-2 text-sm"
                    >
                      <option value="in_progress">Start / resume work</option>
                      <option value="review_ready">Mark review-ready</option>
                    </select>
                    <input
                      name="taskNote"
                      aria-label={`${task.title} transition note`}
                      placeholder="Transition note (optional)"
                      maxLength={2000}
                      className="h-9 min-w-48 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-3 text-sm"
                    />
                  </WorkflowActionForm>
                  {!["completed", "canceled"].includes(task.status) ? (
                    <WorkflowActionForm
                      action={addTaskNote.bind(null, task.id, alteration.id)}
                      className="flex flex-wrap gap-2"
                      submitLabel="Add note"
                      pendingLabel="Adding…"
                    >
                      <input
                        name="taskNote"
                        aria-label={`${task.title} work note`}
                        placeholder="Append a work note"
                        maxLength={2000}
                        required
                        className="h-9 min-w-48 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-3 text-sm"
                      />
                    </WorkflowActionForm>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </Card>
      </div>

      {!isWorker && completionReviews.length > 0 ? (
        <div>
          <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
            Completion reviews
          </h2>
          <Card className="divide-y divide-[var(--color-stone-100)] p-0">
            {completionReviews.map((review) => (
              <div key={review.id} className="px-6 py-4">
                <p className="font-medium">
                  {
                    {
                      pending: "Pending",
                      approved: "Approved",
                      changes_requested: "Changes requested",
                    }[review.status]
                  }
                </p>
                <p className="text-xs text-[var(--color-stone-500)]">
                  {review.reviewedAt
                    ? `Reviewed by ${staffName(review.reviewedByStaffId)} · ${formatDate(review.reviewedAt, "en-US")}`
                    : `Awaiting review · ${formatDate(review.createdAt, "en-US")}`}
                </p>
                {review.notes ? (
                  <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                    {review.notes}
                  </p>
                ) : null}
              </div>
            ))}
          </Card>
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Updates
        </h2>
        <Card className="divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-elevated)]">
          {updates.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-stone-500)]">
              No updates yet.
            </p>
          ) : (
            updates.map((update) => (
              <div key={update.id} className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <AlterationStatusBadge status={update.toStatus} />
                  <span className="text-xs text-[var(--color-stone-500)]">
                    {staffName(update.actorStaffId)} ·{" "}
                    {formatDate(update.createdAt, "en-US")}
                  </span>
                </div>
                {update.note ? (
                  <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                    {update.note}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </Card>
      </div>

      {canAddUpdate ? (
        <UpdateForm
          alterationId={alteration.id}
          currentStatus={alteration.status}
          role={session.retailerRole}
        />
      ) : null}
    </div>
  );
}
