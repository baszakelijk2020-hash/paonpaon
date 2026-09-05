"use server";

import { CustomerRepository, MessagingRepository } from "@paon/database";
import { checkConciergeRequest, conciergeRequestMessage } from "@paon/domain";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface ConciergeRequestState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
  conversationId?: string;
}

const CONCIERGE_REQUEST_ERROR: Readonly<Record<string, string>> = {
  detail_required: "Say a little more about what you'd like arranged.",
  money_movement_not_permitted:
    "Concierge requests can't move money — ask about payment through your advisor instead.",
};

async function resolveCustomer(userId: string, retailerId: string) {
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    userId as never,
  );
  return customers.find((candidate) => candidate.retailerId === retailerId);
}

/**
 * PHASE 15.2's own named gap ("concierge request surface"). The reward
 * half of 15.2 is blocked on ADR-062's stored-value decision; concierge
 * requests deliberately are not (`checkConciergeRequest` refuses only a
 * request that would move money) — same split the domain module's own
 * docblock describes. Reuses the messaging primitives verbatim, same
 * precedent as `requestWardrobeItemService` (PHASE 17.13): no new request
 * table, the retailer's existing inbox is where staff already triage this.
 */
export async function requestConciergeAssistance(
  _prevState: ConciergeRequestState,
  formData: FormData,
): Promise<ConciergeRequestState> {
  const session = await requireSession();
  const retailerId = String(formData.get("retailerId") ?? "").trim();
  const detail = String(formData.get("detail") ?? "");

  if (!retailerId) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  const check = checkConciergeRequest({ detail, involvesPayment: false });
  if (!check.ok) {
    const message =
      CONCIERGE_REQUEST_ERROR[check.reason] ??
      "That request could not be sent.";
    return {
      fieldErrors: { detail: message },
      formError: message,
    };
  }

  const customer = await resolveCustomer(session.userId, retailerId);
  if (!customer) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const messagingRepo = new MessagingRepository(supabase);
    const conversationId = await messagingRepo.getOrCreateForCustomer(
      customer.retailerId,
    );
    await messagingRepo.send(conversationId, conciergeRequestMessage(detail));

    return { fieldErrors: {}, success: true, conversationId };
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not send request.",
    };
  }
}
