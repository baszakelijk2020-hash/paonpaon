import type {
  AcademyRoleplayContext,
  AcademyRoleplayResult,
  AIProvider,
} from "./provider";

/**
 * Runs one academy roleplay turn (PHASE 17.8 / ADV-108) and reports
 * whether the provider call itself succeeded — every attempt (success or
 * failure) is recorded through `AIGenerationRepository` by the caller,
 * same posture as `runCommunicationDraftJob`. This package never persists
 * a turn; that happens through `submit_academy_roleplay_turn`
 * (`@paon/database`) once the caller has a real reply text in hand.
 */
export async function runAcademyRoleplayTurn(
  provider: AIProvider,
  context: AcademyRoleplayContext,
): Promise<{
  readonly ok: boolean;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly result?: AcademyRoleplayResult;
  readonly errorMessage?: string;
}> {
  const started = Date.now();
  try {
    if (!provider.generateAcademyRoleplayReply) {
      throw new Error("AI provider does not support academy roleplay");
    }
    const result = await provider.generateAcademyRoleplayReply(context);
    return {
      ok: true,
      provider: provider.providerName,
      model: provider.model,
      latencyMs: Date.now() - started,
      result,
    };
  } catch (error) {
    return {
      ok: false,
      provider: provider.providerName,
      model: provider.model,
      latencyMs: Date.now() - started,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Academy roleplay reply failed",
    };
  }
}
