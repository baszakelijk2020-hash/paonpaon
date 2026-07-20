"use server";

import { WeddingPartyRepository } from "@paon/database";
import { WEDDING_PARTY_MEMBER_ROLES } from "@paon/domain";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface JoinPartyState {
  formError?: string;
  joined?: boolean;
}

function isMemberRole(
  value: string,
): value is (typeof WEDDING_PARTY_MEMBER_ROLES)[number] {
  return (WEDDING_PARTY_MEMBER_ROLES as readonly string[]).includes(value);
}

/** The only anonymous write on this route — `join_wedding_party`
 * (security definer) is the sole source of truth for whether the
 * token is valid; this action does not read the party first (see
 * WeddingPartyRepository.joinViaInvite's comment). */
export async function joinWeddingParty(
  token: string,
  _prevState: JoinPartyState,
  formData: FormData,
): Promise<JoinPartyState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  if (!name) return { formError: "Your name is required." };
  if (!email || !email.includes("@")) {
    return { formError: "A valid email is required." };
  }
  if (!isMemberRole(role)) return { formError: "Choose a role." };

  const supabase = await getSupabaseServerClient();
  try {
    await new WeddingPartyRepository(supabase).joinViaInvite({
      inviteToken: token,
      name,
      email,
      role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }

  return { joined: true };
}
