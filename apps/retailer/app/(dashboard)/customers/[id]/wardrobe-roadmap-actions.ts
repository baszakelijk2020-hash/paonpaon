"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  CustomerRepository,
  KnowledgeRepository,
  RetailerStaffRepository,
  WardrobeRoadmapRepository,
} from "@paon/database";
import {
  asId,
  createWardrobeGapInputSchema,
  createWardrobeGoalInputSchema,
  createWardrobeRoadmapInputSchema,
  type WardrobeRoadmapStatus,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface RoadmapActionState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

async function requireStaffContext() {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");
  const client = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(client).findByUserId(
    session.userId,
  );
  if (!staff || staff.retailerId !== session.retailerId) {
    throw new Error("Active staff membership required.");
  }
  return { session, client, staff };
}

export async function createWardrobeRoadmap(
  _prevState: RoadmapActionState,
  formData: FormData,
): Promise<RoadmapActionState> {
  const customerIdRaw = String(formData.get("customerId") ?? "");
  try {
    const { session, client, staff } = await requireStaffContext();

    const parsed = createWardrobeRoadmapInputSchema.safeParse({
      retailerId: session.retailerId,
      customerId: customerIdRaw,
      title: formData.get("title"),
      summary: optionalString(formData.get("summary")),
      horizonLabel: optionalString(formData.get("horizonLabel")),
    });
    if (!parsed.success) {
      return { fieldErrors: zodFieldErrors(parsed.error) };
    }

    const customer = await new CustomerRepository(client).findById(
      asId<"CustomerId">(parsed.data.customerId),
    );
    if (!customer || customer.retailerId !== session.retailerId) {
      return { fieldErrors: {}, formError: "Customer not found." };
    }

    await new WardrobeRoadmapRepository(client).createRoadmap(
      {
        ...parsed.data,
        retailerId: session.retailerId,
        customerId: customer.id,
      },
      staff.id,
    );
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not create roadmap.",
    };
  }

  revalidatePath(`/customers/${customerIdRaw}`);
  return { fieldErrors: {}, success: true };
}

export async function addWardrobeRoadmapGoal(
  _prevState: RoadmapActionState,
  formData: FormData,
): Promise<RoadmapActionState> {
  const customerIdRaw = String(formData.get("customerId") ?? "");
  try {
    const { client } = await requireStaffContext();
    const parsed = createWardrobeGoalInputSchema.safeParse({
      roadmapId: formData.get("roadmapId"),
      title: formData.get("title"),
      description: optionalString(formData.get("description")),
      rank: Number(formData.get("rank") ?? 1),
    });
    if (!parsed.success) {
      return { fieldErrors: zodFieldErrors(parsed.error) };
    }
    await new WardrobeRoadmapRepository(client).addGoal(parsed.data);
  } catch (error) {
    return {
      fieldErrors: {},
      formError: error instanceof Error ? error.message : "Could not add goal.",
    };
  }

  revalidatePath(`/customers/${customerIdRaw}`);
  return { fieldErrors: {}, success: true };
}

export async function addWardrobeGap(
  _prevState: RoadmapActionState,
  formData: FormData,
): Promise<RoadmapActionState> {
  const customerIdRaw = String(formData.get("customerId") ?? "");
  try {
    const { session, client } = await requireStaffContext();
    const parsed = createWardrobeGapInputSchema.safeParse({
      roadmapId: formData.get("roadmapId"),
      title: formData.get("title"),
      description: optionalString(formData.get("description")),
      slotKind: formData.get("slotKind"),
      rank: Number(formData.get("rank") ?? 1),
      stagePriority: Number(formData.get("stagePriority") ?? 1),
      conceptId: optionalString(formData.get("conceptId")),
      productId: optionalString(formData.get("productId")),
      wardrobeItemId: optionalString(formData.get("wardrobeItemId")),
      knowledgeObjectId: optionalString(formData.get("knowledgeObjectId")),
    });
    if (!parsed.success) {
      return { fieldErrors: zodFieldErrors(parsed.error) };
    }

    const customer = await new CustomerRepository(client).findById(
      asId<"CustomerId">(customerIdRaw),
    );
    if (!customer || customer.retailerId !== session.retailerId) {
      return { fieldErrors: {}, formError: "Customer not found." };
    }

    await new WardrobeRoadmapRepository(client).addGap(
      parsed.data,
      customer.id,
    );
  } catch (error) {
    return {
      fieldErrors: {},
      formError: error instanceof Error ? error.message : "Could not add gap.",
    };
  }

  revalidatePath(`/customers/${customerIdRaw}`);
  return { fieldErrors: {}, success: true };
}

export async function transitionWardrobeRoadmapStatus(
  _prevState: RoadmapActionState,
  formData: FormData,
): Promise<RoadmapActionState> {
  const customerIdRaw = String(formData.get("customerId") ?? "");
  const status = String(formData.get("status") ?? "") as WardrobeRoadmapStatus;
  try {
    const { session, client, staff } = await requireStaffContext();
    const roadmapId = String(formData.get("roadmapId") ?? "");
    await new WardrobeRoadmapRepository(client).transitionRoadmapStatus(
      asId<"RetailerId">(session.retailerId),
      asId<"WardrobeRoadmapId">(roadmapId),
      status,
      staff.id,
    );
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "Could not update roadmap status.",
    };
  }

  revalidatePath(`/customers/${customerIdRaw}`);
  return { fieldErrors: {}, success: true };
}

export async function createAdvisorOutfit(
  _prevState: RoadmapActionState,
  formData: FormData,
): Promise<RoadmapActionState> {
  const customerIdRaw = String(formData.get("customerId") ?? "");
  try {
    const { session, client, staff } = await requireStaffContext();
    const slotsJson = String(formData.get("slotsJson") ?? "[]");
    const knowledgeIdsJson = String(
      formData.get("knowledgeObjectIdsJson") ?? "[]",
    );
    const slots = JSON.parse(slotsJson) as unknown;
    const knowledgeObjectIds = JSON.parse(knowledgeIdsJson) as unknown;

    const parsed = {
      retailerId: session.retailerId,
      customerId: customerIdRaw,
      roadmapId: optionalString(formData.get("roadmapId")),
      title: formData.get("title"),
      occasionLabel: optionalString(formData.get("occasionLabel")),
      slots,
      knowledgeObjectIds,
    };

    if (typeof parsed.title !== "string" || !Array.isArray(slots)) {
      return { fieldErrors: { form: "Invalid outfit payload." } };
    }

    const knowledgeRepo = new KnowledgeRepository(client);
    const ruleExplanations = new Map<string, string>();
    if (Array.isArray(knowledgeObjectIds)) {
      for (const id of knowledgeObjectIds) {
        if (typeof id !== "string") continue;
        const object = await knowledgeRepo.findById(
          asId<"RetailerId">(session.retailerId),
          asId<"KnowledgeObjectId">(id),
        );
        if (object) {
          ruleExplanations.set(id, object.summary ?? object.title);
        }
      }
    }

    await new WardrobeRoadmapRepository(client).createOutfit(
      {
        retailerId: session.retailerId,
        customerId: customerIdRaw,
        roadmapId: parsed.roadmapId,
        title: parsed.title,
        occasionLabel: parsed.occasionLabel,
        slots: slots as never,
        knowledgeObjectIds: Array.isArray(knowledgeObjectIds)
          ? (knowledgeObjectIds as string[])
          : [],
      },
      staff.id,
      ruleExplanations,
    );
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not create outfit.",
    };
  }

  revalidatePath(`/customers/${customerIdRaw}`);
  return { fieldErrors: {}, success: true };
}

export async function transitionOutfitStatus(
  _prevState: RoadmapActionState,
  formData: FormData,
): Promise<RoadmapActionState> {
  const customerIdRaw = String(formData.get("customerId") ?? "");
  const status = String(formData.get("status") ?? "");
  try {
    const { session, client, staff } = await requireStaffContext();
    const outfitId = String(formData.get("outfitId") ?? "");
    await new WardrobeRoadmapRepository(client).transitionOutfitStatus(
      asId<"RetailerId">(session.retailerId),
      outfitId,
      status as "draft" | "proposed" | "approved",
      staff.id,
    );
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "Could not update outfit status.",
    };
  }

  revalidatePath(`/customers/${customerIdRaw}`);
  return { fieldErrors: {}, success: true };
}
