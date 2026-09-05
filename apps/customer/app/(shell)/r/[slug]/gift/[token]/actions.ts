"use server";

import { GiftRepository, RetailerRepository } from "@paon/database";
import { redeemGiftInvitationInputSchema } from "@paon/domain";

import { assertRetailerModuleActive } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface RedeemGiftState {
  formError?: string;
  redeemed?: boolean;
}

export async function redeemGift(
  slug: string,
  token: string,
  _prevState: RedeemGiftState,
  formData: FormData,
): Promise<RedeemGiftState> {
  const parsed = redeemGiftInvitationInputSchema.safeParse({
    inviteToken: token,
    curatedItemId: formData.get("curatedItemId"),
    recipientName: formData.get("recipientName"),
    recipientEmail: formData.get("recipientEmail"),
  });
  if (!parsed.success) {
    return { formError: "Choose a piece and share your name and email." };
  }

  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer) {
    return { formError: "This gift link is no longer valid." };
  }

  try {
    await assertRetailerModuleActive(supabase, retailer.id, "commerce_growth");
    await new GiftRepository(supabase).redeemInvitation({
      inviteToken: parsed.data.inviteToken,
      curatedItemId: parsed.data.curatedItemId as never,
      recipientName: parsed.data.recipientName,
      recipientEmail: parsed.data.recipientEmail,
    });
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Something went wrong.",
    };
  }

  return { redeemed: true };
}
