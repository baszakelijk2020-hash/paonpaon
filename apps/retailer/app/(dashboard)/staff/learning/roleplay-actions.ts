"use server";

import { runAcademyRoleplayTurn } from "@paon/ai";
import { requireRetailerRole } from "@paon/auth";
import {
  AcademyRoleplayRepository,
  AIGenerationRepository,
  RetailerStaffRepository,
  type AcademyRoleplayMessage,
  type AcademyRoleplaySession,
} from "@paon/database";
import {
  ACADEMY_ROLEPLAY_PERSONA_LABELS,
  ACADEMY_ROLEPLAY_PERSONAS,
  asId,
  type AcademyRoleplayPersona,
  type RetailerId,
  type StaffId,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { getAIProvider } from "@/lib/ai";
import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface RoleplayActionState {
  readonly formError?: string;
  readonly session?: AcademyRoleplaySession;
  readonly messages?: readonly AcademyRoleplayMessage[];
}

async function resolveViewerStaffId(): Promise<{
  readonly retailerId: RetailerId;
  readonly staffId: StaffId;
}> {
  const session = await requireModuleSession("retail_operations", "mutate");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const supabase = await getSupabaseServerClient();
  const viewer = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!viewer) {
    throw new Error("Your staff record could not be found.");
  }
  return {
    retailerId: session.retailerId,
    staffId: asId<"StaffId">(viewer.id),
  };
}

export async function startRoleplaySession(
  _previous: RoleplayActionState,
  formData: FormData,
): Promise<RoleplayActionState> {
  const { retailerId } = await resolveViewerStaffId();
  const personaKeyRaw = String(formData.get("personaKey") ?? "").trim();
  if (
    !ACADEMY_ROLEPLAY_PERSONAS.includes(personaKeyRaw as AcademyRoleplayPersona)
  ) {
    return { formError: "Choose a persona to practice with." };
  }
  const personaKey = personaKeyRaw as AcademyRoleplayPersona;

  const supabase = await getSupabaseServerClient();
  const repo = new AcademyRoleplayRepository(supabase);
  const session = await repo.startSession({
    retailerId,
    personaKey,
  });
  const messages = await repo.findMessagesBySession(session.id);

  revalidatePath("/staff/learning");
  return { session, messages };
}

/**
 * One roleplay turn: calls the real AI persona (or the deterministic mock
 * under `PAON_E2E_MOCK_AI=1`), records the provider attempt through
 * `AIGenerationRepository` whether it succeeds or fails (every AI call is
 * audited, same posture as 17.14's communication drafts), then persists
 * both the advisor line and the reply together through
 * `submit_academy_roleplay_turn`. A failed provider call never writes a
 * fabricated reply — the advisor sees a clear error and can retry.
 */
export async function submitRoleplayMessage(
  sessionId: string,
  _previous: RoleplayActionState,
  formData: FormData,
): Promise<RoleplayActionState> {
  const { retailerId, staffId } = await resolveViewerStaffId();
  const advisorText = String(formData.get("advisorText") ?? "").trim();
  if (!advisorText) {
    return { formError: "Write a line before sending." };
  }

  const supabase = await getSupabaseServerClient();
  const repo = new AcademyRoleplayRepository(supabase);
  const session = await repo.findSessionById(sessionId);
  if (!session || session.staffId !== staffId || session.status !== "active") {
    return { formError: "This practice session is no longer active." };
  }

  const priorMessages = await repo.findMessagesBySession(sessionId);
  const provider = getAIProvider();
  const generationRepo = new AIGenerationRepository(supabase);

  if (!provider) {
    await generationRepo.record({
      retailerId,
      requestedByStaffId: staffId,
      kind: "academy_roleplay",
      status: "failed",
      provider: "none",
      model: "none",
      inputSummary: `roleplay turn (${session.personaKey})`,
      errorMessage: "AI provider is not configured.",
    });
    return {
      formError:
        "AI practice is not configured in this environment (no provider key). Ask a manager to grade this session in person instead.",
    };
  }

  const outcome = await runAcademyRoleplayTurn(provider, {
    retailerName: session.retailerId,
    personaKey: session.personaKey,
    personaDescription: ACADEMY_ROLEPLAY_PERSONA_LABELS[session.personaKey],
    transcript: priorMessages.map((message) => ({
      speaker: message.speaker,
      text: message.content,
    })),
    latestAdvisorMessage: advisorText,
  });

  await generationRepo.record({
    retailerId,
    requestedByStaffId: staffId,
    kind: "academy_roleplay",
    status: outcome.ok ? "succeeded" : "failed",
    provider: outcome.provider,
    model: outcome.model,
    inputSummary: `roleplay turn (${session.personaKey})`,
    ...(outcome.result
      ? { output: { replyText: outcome.result.replyText } }
      : {}),
    ...(outcome.errorMessage ? { errorMessage: outcome.errorMessage } : {}),
    latencyMs: outcome.latencyMs,
  });

  if (!outcome.ok || !outcome.result) {
    return {
      formError:
        outcome.errorMessage ?? "The AI persona could not reply. Try again.",
    };
  }

  await repo.submitTurn({
    sessionId,
    advisorText,
    personaText: outcome.result.replyText,
  });
  const messages = await repo.findMessagesBySession(sessionId);
  const refreshedSession = await repo.findSessionById(sessionId);

  revalidatePath("/staff/learning");
  return {
    ...(refreshedSession ? { session: refreshedSession } : {}),
    messages,
  };
}

export async function endRoleplaySession(
  sessionId: string,
  status: "completed" | "abandoned",
): Promise<void> {
  const { staffId } = await resolveViewerStaffId();
  const supabase = await getSupabaseServerClient();
  const repo = new AcademyRoleplayRepository(supabase);
  const session = await repo.findSessionById(sessionId);
  if (!session || session.staffId !== staffId) {
    throw new Error("This practice session is not yours to end.");
  }
  await repo.endSession({ sessionId, status });
  revalidatePath("/staff/learning");
}
