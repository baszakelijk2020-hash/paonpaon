"use server";

import {
  CustomerRepository,
  MessagingRepository,
  WardrobeRepository,
} from "@paon/database";
import { z } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface AdvisorAskState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
  conversationId?: string;
}

async function resolveCustomer(userId: string, retailerId: string) {
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    userId as never,
  );
  return customers.find((candidate) => candidate.retailerId === retailerId);
}

const STARTER_PROMPTS = [
  "complete_the_look",
  "fit_check",
  "discuss_roadmap_gap",
] as const;

function starterPromptText(prompt: (typeof STARTER_PROMPTS)[number]): string {
  switch (prompt) {
    case "complete_the_look":
      return "Could you help me complete the look around this piece?";
    case "fit_check":
      return "Could we set up a fit-check for this item?";
    case "discuss_roadmap_gap":
      return "Could we discuss this next step on my wardrobe plan?";
  }
}

/**
 * Wardrobe's "Ask your advisor" deck action (contract §5.4/§5.5) — attaches
 * a real garment/roadmap-gap reference to a starter prompt and sends it
 * through the same real conversation channel every other wardrobe request
 * already uses, rather than a separate messaging construct.
 */
export async function askAdvisorAboutWardrobeItem(
  _prevState: AdvisorAskState,
  formData: FormData,
): Promise<AdvisorAskState> {
  const session = await requireSession();
  const retailerId = z.string().uuid().safeParse(formData.get("retailerId"));
  const starterPrompt = z
    .enum(STARTER_PROMPTS)
    .safeParse(formData.get("starterPrompt"));
  const wardrobeItemIdRaw = formData.get("wardrobeItemId");
  const wardrobeItemId =
    typeof wardrobeItemIdRaw === "string" && wardrobeItemIdRaw.length > 0
      ? wardrobeItemIdRaw
      : undefined;
  const roadmapGapTitleRaw = formData.get("roadmapGapTitle");
  const roadmapGapTitle =
    typeof roadmapGapTitleRaw === "string" && roadmapGapTitleRaw.length > 0
      ? roadmapGapTitleRaw
      : undefined;

  if (!retailerId.success || !starterPrompt.success) {
    return {
      fieldErrors: {
        ...(!retailerId.success ? { retailerId: "Invalid retailer." } : {}),
        ...(!starterPrompt.success ? { starterPrompt: "Invalid prompt." } : {}),
      },
    };
  }

  const customer = await resolveCustomer(session.userId, retailerId.data);
  if (!customer) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  let subjectLabel = roadmapGapTitle;
  if (wardrobeItemId) {
    const supabase = await getSupabaseServerClient();
    const item = await new WardrobeRepository(supabase).findById(
      wardrobeItemId as never,
    );
    if (
      !item ||
      item.customerId !== customer.id ||
      item.retailerId !== customer.retailerId
    ) {
      return { fieldErrors: {}, formError: "Wardrobe item not found." };
    }
    subjectLabel = item.brand
      ? `${item.brand} ${item.displayName}`
      : item.displayName;
  }

  try {
    const supabase = await getSupabaseServerClient();
    const messagingRepo = new MessagingRepository(supabase);
    const conversationId = await messagingRepo.getOrCreateForCustomer(
      customer.retailerId,
    );
    const promptText = starterPromptText(starterPrompt.data);
    const body = subjectLabel
      ? `${promptText} (Regarding: ${subjectLabel})`
      : promptText;
    await messagingRepo.send(conversationId, body);
    return { fieldErrors: {}, success: true, conversationId };
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not send request.",
    };
  }
}
