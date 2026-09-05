"use server";

import { CustomerRepository, WardrobeRoadmapRepository } from "@paon/database";
import { asId, transitionWardrobeRoadmapInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CustomerRoadmapActionState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

function zodFieldErrors(error: {
  issues: readonly { path: PropertyKey[]; message: string }[];
}): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

async function resolveCustomer(userId: string, retailerId: string) {
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    userId as never,
  );
  return customers.find((candidate) => candidate.retailerId === retailerId);
}

export async function decideWardrobeRoadmap(
  _prevState: CustomerRoadmapActionState,
  formData: FormData,
): Promise<CustomerRoadmapActionState> {
  const session = await requireSession();
  const action = String(formData.get("action") ?? "");
  if (action !== "approve" && action !== "reject") {
    return { fieldErrors: {}, formError: "Choose approve or reject." };
  }

  const parsed = transitionWardrobeRoadmapInputSchema.safeParse({
    roadmapId: formData.get("roadmapId"),
    action,
    note:
      typeof formData.get("note") === "string"
        ? String(formData.get("note")).trim() || undefined
        : undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await getSupabaseServerClient();
  const repo = new WardrobeRoadmapRepository(supabase);
  const existing = await repo.findById(
    asId<"WardrobeRoadmapId">(parsed.data.roadmapId),
  );
  if (!existing) {
    return { fieldErrors: {}, formError: "Roadmap not found." };
  }

  const customer = await resolveCustomer(session.userId, existing.retailerId);
  if (!customer || customer.id !== existing.customerId) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  try {
    await repo.transition(parsed.data, {
      kind: "customer",
      customerId: customer.id,
      retailerId: customer.retailerId,
    });
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not update roadmap.",
    };
  }

  revalidatePath("/wardrobe");
  return { fieldErrors: {}, success: true };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Phase 20.17 — the customer removes one advisor selection (an approved
 * wardrobe roadmap's open gap) from their own wardrobe-plan presentation.
 * The advisor-authored roadmap, gaps, stages, and audit history are never
 * deleted or mutated; a customer-scoped disposition row is recorded and the
 * wardrobe page filters the gap out. Requires the real authenticated
 * customer session and an existing relationship with the retailer; the
 * database trigger + RLS policy independently re-verify ownership and that
 * the gap is on this customer's own approved roadmap.
 */
export async function removeAdvisorSelectionFromPlan(
  _prevState: CustomerRoadmapActionState,
  formData: FormData,
): Promise<CustomerRoadmapActionState> {
  const session = await requireSession();
  const roadmapGapId = String(formData.get("roadmapGapId") ?? "");
  const retailerId = String(formData.get("retailerId") ?? "");
  if (!UUID_RE.test(roadmapGapId) || !UUID_RE.test(retailerId)) {
    return { fieldErrors: {}, formError: "Invalid advisor selection." };
  }

  const customer = await resolveCustomer(session.userId, retailerId);
  if (!customer) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const repo = new WardrobeRoadmapRepository(supabase);
  const roadmaps = await repo.findByCustomer(customer.id, {
    customerVisibleOnly: true,
  });
  const approved = roadmaps.find((roadmap) => roadmap.status === "approved");
  if (!approved) {
    return { fieldErrors: {}, formError: "No approved wardrobe plan." };
  }

  const gap = approved.gaps.find((candidate) => candidate.id === roadmapGapId);
  if (!gap) {
    return {
      fieldErrors: {},
      formError: "That advisor selection is not on your plan.",
    };
  }

  try {
    await repo.removeAdvisorSelectionFromPlan({
      roadmapGapId,
      roadmapId: approved.id,
      retailerId: customer.retailerId,
      customerId: customer.id,
    });
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "Could not remove the selection.",
    };
  }

  revalidatePath("/wardrobe");
  return { fieldErrors: {}, success: true };
}
