"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  CustomerRepository,
  ProductRepository,
  RetailerStaffRepository,
  SartorialRuleRepository,
  WardrobeRoadmapRepository,
} from "@paon/database";
import {
  asId,
  createWardrobeRoadmapInputSchema,
  NEUTRAL_SARTORIAL_RULE_FIXTURES,
  OUTFIT_SLOT_KINDS,
  transitionWardrobeRoadmapInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
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

export async function createCustomerWardrobeRoadmap(
  _prevState: RoadmapActionState,
  formData: FormData,
): Promise<RoadmapActionState> {
  const session = await requireModuleSession("wardrobe_styling");
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId as never,
  );
  if (!staff) {
    return { fieldErrors: {}, formError: "Staff session required." };
  }
  requireRetailerRole(staff.role, "sales_associate");

  const customerId = String(formData.get("customerId") ?? "");
  const customer = await new CustomerRepository(supabase).findById(
    asId<"CustomerId">(customerId),
  );
  if (!customer || customer.retailerId !== staff.retailerId) {
    return { fieldErrors: {}, formError: "Customer not found in this house." };
  }

  const slotKindRaw = optionalString(formData.get("gapSlotKind"));
  const slotKind =
    slotKindRaw &&
    (OUTFIT_SLOT_KINDS as readonly string[]).includes(slotKindRaw)
      ? slotKindRaw
      : "jacket";

  const productId = optionalString(formData.get("suggestedProductId"));
  const products = await new ProductRepository(supabase).findByRetailer(
    staff.retailerId,
  );
  const suggested =
    products.find((product) => product.id === productId) ?? products[0];
  if (!suggested) {
    return {
      fieldErrors: {},
      formError:
        "Add a catalogue product before authoring a staged suggestion.",
    };
  }

  const approvedRules = await new SartorialRuleRepository(
    supabase,
  ).listApprovedForRetailer(staff.retailerId);
  const rule =
    approvedRules.find(
      (entry) =>
        entry.subjectSlotKind === slotKind || entry.objectSlotKind === slotKind,
    ) ??
    approvedRules[0] ??
    NEUTRAL_SARTORIAL_RULE_FIXTURES[0];
  if (!rule) {
    return {
      fieldErrors: {},
      formError:
        "No approved sartorial rule is available to cite for this suggestion.",
    };
  }

  const goalTitle =
    optionalString(formData.get("goalTitle")) ??
    "Build a stronger wardrobe core";
  const gapTitle =
    optionalString(formData.get("gapTitle")) ?? `Missing ${slotKind}`;
  const howFills =
    optionalString(formData.get("howPurchaseFillsGap")) ??
    `Adds a ${slotKind} that fills the ranked gap.`;
  const stageTitle =
    optionalString(formData.get("stageTitle")) ?? `Stage 1 — ${slotKind}`;
  const explanation =
    optionalString(formData.get("explanation")) ??
    `Prioritise ${suggested.name} to fill “${gapTitle}”, citing an approved rule and owned/catalogue facts.`;

  const parsed = createWardrobeRoadmapInputSchema.safeParse({
    retailerId: staff.retailerId,
    customerId: customer.id,
    title: optionalString(formData.get("title")) ?? "Wardrobe roadmap",
    summary: optionalString(formData.get("summary")),
    horizonLabel: optionalString(formData.get("horizonLabel")) ?? "12 months",
    goals: [{ title: goalTitle, displayOrder: 0 }],
    gaps: [
      {
        title: gapTitle,
        rank: 1,
        slotKind,
        howPurchaseFillsGap: howFills,
      },
    ],
    stages: [
      {
        title: stageTitle,
        stageOrder: 1,
        gapIndex: 0,
        suggestedProductId: suggested.id,
        explanation,
        ruleCitations: [
          {
            ruleId: rule.id,
            ruleTitle: rule.title,
            relation: rule.relation,
            explanation: rule.explanation,
          },
        ],
        factCitations: [
          {
            sourceKind: "catalogue_product",
            sourceId: suggested.id,
            label: suggested.name,
            detail: `Catalogue ${slotKind} suggested to fill the gap`,
          },
        ],
      },
    ],
  });

  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  try {
    const roadmap = await new WardrobeRoadmapRepository(supabase).createDraft(
      parsed.data,
      staff.id,
    );
    await new WardrobeRoadmapRepository(supabase).transition(
      { roadmapId: roadmap.id, action: "submit_for_approval" },
      {
        kind: "advisor",
        retailerId: staff.retailerId,
        role: staff.role,
      },
    );
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not save roadmap.",
    };
  }

  revalidatePath(`/customers/${customer.id}`);
  return { fieldErrors: {}, success: true };
}

export async function submitRoadmapForApproval(
  _prevState: RoadmapActionState,
  formData: FormData,
): Promise<RoadmapActionState> {
  const session = await requireModuleSession("wardrobe_styling");
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId as never,
  );
  if (!staff) {
    return { fieldErrors: {}, formError: "Staff session required." };
  }
  requireRetailerRole(staff.role, "sales_associate");

  const parsed = transitionWardrobeRoadmapInputSchema.safeParse({
    roadmapId: formData.get("roadmapId"),
    action: "submit_for_approval",
  });
  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  try {
    const roadmap = await new WardrobeRoadmapRepository(supabase).transition(
      parsed.data,
      {
        kind: "advisor",
        retailerId: staff.retailerId,
        role: staff.role,
      },
    );
    revalidatePath(`/customers/${roadmap.customerId}`);
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not submit roadmap.",
    };
  }

  return { fieldErrors: {}, success: true };
}
