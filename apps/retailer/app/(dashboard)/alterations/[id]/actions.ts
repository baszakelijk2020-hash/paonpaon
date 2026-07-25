"use server";

import { randomUUID } from "node:crypto";

import { ForbiddenError, requireAlterationsPermission } from "@paon/auth";
import {
  AlterationUpdateRepository,
  AlterationAttachmentRepository,
  AlterationTaskRepository,
  AlterationHandoffRepository,
  AlterationWorkflowRepository,
  PhysicalGarmentRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  addAlterationUpdateInputSchema,
  asId,
  retailerRoleHasAlterationsPermission,
  decidePriceChangeInputSchema,
  proposePriceChangeInputSchema,
  recordCustodyEventInputSchema,
  recordFulfillmentInputSchema,
} from "@paon/domain";
import { stripUndefined } from "@paon/utils";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface AddAlterationUpdateFormState {
  formError?: string;
}

export interface PricingActionState {
  formError?: string;
  success?: boolean;
}

export interface WorkflowActionState {
  formError?: string;
  successMessage?: string;
}

function workflowError(error: unknown, fallback: string): WorkflowActionState {
  return { formError: error instanceof Error ? error.message : fallback };
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export async function uploadAlterationPhoto(
  alterationId: string,
  _state: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const session = await requireSession();
  const allowed = [
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
  if (!allowed) throw new ForbiddenError();

  const file = formData.get("photo");
  const kind = formData.get("attachmentKind");
  const taskId = formData.get("attachmentTaskId");
  if (!(file instanceof File) || file.size === 0) {
    return { formError: "Choose an image." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { formError: "Images must be 10 MB or smaller." };
  }
  if (
    !ALLOWED_IMAGE_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
    )
  ) {
    return { formError: "Use a JPEG, PNG or WebP image." };
  }
  if (
    !["intake", "evidence", "progress", "completion"].includes(String(kind))
  ) {
    return { formError: "Choose a valid image kind." };
  }
  if (session.retailerRole === "worker" && kind === "intake") {
    throw new ForbiddenError("Workers cannot add intake evidence.");
  }

  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
  const storagePath = `${session.retailerId}/${alterationId}/${randomUUID()}-${safeName}`;
  try {
    await new AlterationAttachmentRepository(supabase).uploadImage({
      retailerId: session.retailerId,
      alterationId: asId<"AlterationId">(alterationId),
      ...(typeof taskId === "string" && taskId
        ? { taskId: asId<"AlterationTaskId">(taskId) }
        : {}),
      ...(staff ? { staffId: staff.id } : {}),
      kind: kind as "intake" | "evidence" | "progress" | "completion",
      storagePath,
      fileName: file.name,
      mimeType: file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
      sizeBytes: file.size,
      content: await file.arrayBuffer(),
    });
  } catch (error) {
    return workflowError(error, "Unable to upload image.");
  }
  revalidatePath(`/alterations/${alterationId}`);
  return { successMessage: "Image uploaded." };
}

export async function proposePriceChange(
  alterationId: string,
  _state: PricingActionState,
  formData: FormData,
): Promise<PricingActionState> {
  const session = await requireSession();
  if (
    !retailerRoleHasAlterationsPermission(
      session.retailerRole,
      "manage_assigned_workshop",
    )
  ) {
    throw new ForbiddenError();
  }
  const rawProposed = formData.get("proposedAmount");
  const proposed =
    typeof rawProposed === "string" && rawProposed.trim()
      ? Number(rawProposed)
      : Number.NaN;
  const parsed = proposePriceChangeInputSchema.safeParse({
    taskId: formData.get("taskId") || undefined,
    proposedAmountMinorUnits: Number.isFinite(proposed)
      ? Math.round(proposed * 100)
      : proposed,
    explanation: formData.get("explanation"),
    evidenceAttachmentId: formData.get("evidenceAttachmentId") || undefined,
  });
  if (!parsed.success)
    return {
      formError: parsed.error.issues[0]?.message ?? "Invalid proposal.",
    };
  try {
    await new AlterationWorkflowRepository(
      await getSupabaseServerClient(),
    ).proposePriceChange({
      alterationId: asId<"AlterationId">(alterationId),
      proposedAmountMinorUnits: parsed.data.proposedAmountMinorUnits,
      explanation: parsed.data.explanation,
      ...(parsed.data.taskId
        ? { taskId: asId<"AlterationTaskId">(parsed.data.taskId) }
        : {}),
      ...(parsed.data.evidenceAttachmentId
        ? { evidenceAttachmentId: parsed.data.evidenceAttachmentId }
        : {}),
    });
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Unable to submit proposal.",
    };
  }
  revalidatePath(`/alterations/${alterationId}`);
  return { success: true };
}

export async function decidePriceChange(
  proposalId: string,
  alterationId: string,
  _state: PricingActionState,
  formData: FormData,
): Promise<PricingActionState> {
  const session = await requireSession();
  if (
    !retailerRoleHasAlterationsPermission(
      session.retailerRole,
      "approve_pricing",
    )
  ) {
    throw new ForbiddenError();
  }
  const parsed = decidePriceChangeInputSchema.safeParse({
    decision: formData.get("decision"),
    reason: formData.get("reason"),
  });
  if (!parsed.success)
    return {
      formError: parsed.error.issues[0]?.message ?? "Invalid decision.",
    };
  try {
    await new AlterationWorkflowRepository(
      await getSupabaseServerClient(),
    ).decidePriceChange({
      proposalId: asId<"PriceChangeProposalId">(proposalId),
      decision: parsed.data.decision,
      reason: parsed.data.reason,
    });
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Unable to decide proposal.",
    };
  }
  revalidatePath(`/alterations/${alterationId}`);
  return { success: true };
}

export async function updateTaskStatus(
  taskId: string,
  alterationId: string,
  _state: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const session = await requireSession();
  const mayWork = [
    "oversight",
    "manage_assigned_workshop",
    "work_assigned_tasks",
  ].some((permission) =>
    retailerRoleHasAlterationsPermission(
      session.retailerRole,
      permission as Parameters<typeof retailerRoleHasAlterationsPermission>[1],
    ),
  );
  if (!mayWork) throw new ForbiddenError();
  const status = formData.get("taskStatus");
  if (status !== "in_progress" && status !== "review_ready") {
    return { formError: "Choose a valid task status." };
  }
  try {
    await new AlterationTaskRepository(
      await getSupabaseServerClient(),
    ).updateStatus(
      asId<"AlterationTaskId">(taskId),
      status,
      typeof formData.get("taskNote") === "string" &&
        String(formData.get("taskNote")).trim()
        ? String(formData.get("taskNote")).trim()
        : undefined,
    );
  } catch (error) {
    return workflowError(error, "Unable to update task.");
  }
  revalidatePath(`/alterations/${alterationId}`);
  return { successMessage: "Task updated." };
}

export async function addTaskNote(
  taskId: string,
  alterationId: string,
  _state: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const session = await requireSession();
  const mayWork = [
    "oversight",
    "manage_assigned_workshop",
    "work_assigned_tasks",
  ].some((permission) =>
    retailerRoleHasAlterationsPermission(
      session.retailerRole,
      permission as Parameters<typeof retailerRoleHasAlterationsPermission>[1],
    ),
  );
  if (!mayWork) throw new ForbiddenError();
  const note = formData.get("taskNote");
  if (typeof note !== "string" || !note.trim() || note.trim().length > 2000) {
    return { formError: "Enter a work note of up to 2,000 characters." };
  }
  try {
    await new AlterationTaskRepository(await getSupabaseServerClient()).addNote(
      asId<"AlterationTaskId">(taskId),
      note.trim(),
    );
  } catch (error) {
    return workflowError(error, "Unable to add work note.");
  }
  revalidatePath(`/alterations/${alterationId}`);
  return { successMessage: "Work note added." };
}

export async function assignWorkOrder(
  alterationId: string,
  _state: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const session = await requireSession();
  requireAlterationsPermission(session.retailerRole, "configure");
  const workshopId = formData.get("workshopId");
  const targetDate = formData.get("targetCompletionDate");
  if (typeof workshopId !== "string" || !workshopId) {
    return { formError: "Choose a workshop." };
  }
  try {
    await new AlterationWorkflowRepository(
      await getSupabaseServerClient(),
    ).assign({
      alterationId: asId<"AlterationId">(alterationId),
      workshopId: asId<"WorkshopId">(workshopId),
      ...(typeof targetDate === "string" && targetDate
        ? { targetCompletionDate: targetDate }
        : {}),
    });
  } catch (error) {
    return workflowError(error, "Unable to assign workshop.");
  }
  revalidatePath(`/alterations/${alterationId}`);
  return { successMessage: "Workshop assigned." };
}

export async function updateWorkshopAssignment(
  alterationId: string,
  _state: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const session = await requireSession();
  requireAlterationsPermission(
    session.retailerRole,
    "manage_assigned_workshop",
  );
  const workerId = formData.get("workerId");
  const targetDate = formData.get("targetCompletionDate");
  try {
    await new AlterationWorkflowRepository(
      await getSupabaseServerClient(),
    ).updateWorkshopAssignment({
      alterationId: asId<"AlterationId">(alterationId),
      ...(typeof workerId === "string" && workerId
        ? { workerId: asId<"StaffId">(workerId) }
        : {}),
      ...(typeof targetDate === "string" && targetDate
        ? { targetCompletionDate: targetDate }
        : {}),
    });
  } catch (error) {
    return workflowError(error, "Unable to update workshop assignment.");
  }
  revalidatePath(`/alterations/${alterationId}`);
  return { successMessage: "Workshop assignment updated." };
}

export async function recordCustodyEvent(
  alterationId: string,
  _state: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const session = await requireSession();
  const allowed = ["intake", "oversight", "manage_assigned_workshop"].some(
    (permission) =>
      retailerRoleHasAlterationsPermission(
        session.retailerRole,
        permission as Parameters<
          typeof retailerRoleHasAlterationsPermission
        >[1],
      ),
  );
  if (!allowed) throw new ForbiddenError();
  const parsed = recordCustodyEventInputSchema.safeParse({
    eventType: formData.get("eventType"),
    fromParty: formData.get("fromParty") || undefined,
    toParty: formData.get("toParty") || undefined,
    conditionNote: formData.get("conditionNote") || undefined,
  });
  if (!parsed.success) {
    return {
      formError: parsed.error.issues[0]?.message ?? "Invalid custody event.",
    };
  }
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  try {
    await new AlterationHandoffRepository(supabase).recordCustody({
      alterationId: asId<"AlterationId">(alterationId),
      retailerId: session.retailerId,
      eventType: parsed.data.eventType,
      ...(parsed.data.fromParty ? { fromParty: parsed.data.fromParty } : {}),
      ...(parsed.data.toParty ? { toParty: parsed.data.toParty } : {}),
      ...(parsed.data.conditionNote
        ? { conditionNote: parsed.data.conditionNote }
        : {}),
      ...(staff ? { actorStaffId: staff.id } : {}),
    });
  } catch (error) {
    return workflowError(error, "Unable to record handoff.");
  }
  revalidatePath(`/alterations/${alterationId}`);
  return { successMessage: "Chain of custody updated." };
}

export async function recordFulfillment(
  alterationId: string,
  _state: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const session = await requireSession();
  const allowed =
    retailerRoleHasAlterationsPermission(session.retailerRole, "oversight") ||
    retailerRoleHasAlterationsPermission(session.retailerRole, "intake");
  if (!allowed) throw new ForbiddenError();
  const rawScheduledAt = formData.get("scheduledAt");
  const deliveryLine1 = formData.get("deliveryLine1");
  const parsed = recordFulfillmentInputSchema.safeParse({
    method: formData.get("method"),
    status: formData.get("fulfillmentStatus"),
    scheduledAt:
      typeof rawScheduledAt === "string" && rawScheduledAt
        ? new Date(rawScheduledAt).toISOString()
        : undefined,
    deliveryAddress:
      formData.get("method") === "delivery" &&
      typeof deliveryLine1 === "string" &&
      deliveryLine1.trim()
        ? {
            line1: deliveryLine1,
            line2: formData.get("deliveryLine2") || undefined,
            city: formData.get("deliveryCity"),
            region: formData.get("deliveryRegion") || undefined,
            postalCode: formData.get("deliveryPostalCode"),
            countryCode: formData.get("deliveryCountryCode"),
          }
        : undefined,
    releasedToName: formData.get("releasedToName") || undefined,
    verificationNote: formData.get("verificationNote") || undefined,
  });
  if (!parsed.success) {
    return {
      formError:
        parsed.error.issues[0]?.message ?? "Invalid fulfillment event.",
    };
  }
  try {
    await new AlterationHandoffRepository(
      await getSupabaseServerClient(),
    ).recordFulfillment({
      alterationId: asId<"AlterationId">(alterationId),
      retailerId: session.retailerId,
      method: parsed.data.method,
      status: parsed.data.status,
      ...(parsed.data.scheduledAt
        ? { scheduledAt: parsed.data.scheduledAt }
        : {}),
      ...(parsed.data.deliveryAddress
        ? { deliveryAddress: stripUndefined(parsed.data.deliveryAddress) }
        : {}),
      ...(parsed.data.releasedToName
        ? { releasedToName: parsed.data.releasedToName }
        : {}),
      ...(parsed.data.verificationNote
        ? { verificationNote: parsed.data.verificationNote }
        : {}),
    });
  } catch (error) {
    return workflowError(error, "Unable to record pickup or delivery.");
  }
  revalidatePath(`/alterations/${alterationId}`);
  return { successMessage: "Pickup or delivery updated." };
}

export async function recordFitToolObservation(
  alterationId: string,
  physicalGarmentId: string,
  area: string,
  observation: string,
): Promise<WorkflowActionState> {
  const session = await requireSession();
  const allowed = [
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
  if (!allowed) throw new ForbiddenError();
  try {
    await new PhysicalGarmentRepository(
      await getSupabaseServerClient(),
    ).addObservation({
      physicalGarmentId: asId<"PhysicalGarmentId">(physicalGarmentId),
      area,
      observation,
    });
  } catch (error) {
    return workflowError(error, "Unable to record fit-tool observation.");
  }
  revalidatePath(`/alterations/${alterationId}`);
  return { successMessage: "Observation recorded." };
}

export async function addAlterationUpdate(
  alterationId: string,
  _prevState: AddAlterationUpdateFormState,
  formData: FormData,
): Promise<AddAlterationUpdateFormState> {
  const session = await requireSession();
  const canProgress = [
    "oversight",
    "intake",
    "manage_assigned_workshop",
    "work_assigned_tasks",
  ].some((permission) =>
    retailerRoleHasAlterationsPermission(
      session.retailerRole,
      permission as Parameters<typeof retailerRoleHasAlterationsPermission>[1],
    ),
  );
  if (!canProgress) throw new ForbiddenError();

  const parsed = addAlterationUpdateInputSchema.safeParse({
    status: formData.get("status"),
    note: formData.get("note") || undefined,
    customerVisible: formData.get("customerVisible") === "on",
  });

  if (!parsed.success) {
    return { formError: "Choose a valid status." };
  }

  const supabase = await getSupabaseServerClient();

  try {
    await new AlterationUpdateRepository(supabase).transition({
      alterationId: asId<"AlterationId">(alterationId),
      toStatus: parsed.data.status,
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
      customerVisible: parsed.data.customerVisible,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }

  revalidatePath(`/alterations/${alterationId}`);
  return {};
}
