import { MockGroundedAnswerProvider } from "./grounded-answer-runner";
import type {
  AcademyRoleplayContext,
  AcademyRoleplayResult,
  AIProvider,
  CommunicationDraftContext,
  CommunicationDraftResult,
} from "./provider";

export interface MockCommunicationDraftProviderOptions {
  readonly result?: CommunicationDraftResult;
  readonly errorMessage?: string;
}

/**
 * Deterministic provider used only by tests and local browser proof. This
 * is the one mock class `apps/retailer/lib/ai.ts` wires under
 * `PAON_E2E_MOCK_AI=1`, so it also carries academy-roleplay replies
 * (PHASE 17.8 / ADV-108) rather than adding a second retailer-app mock
 * selection mechanism for one more capability.
 */
export class MockCommunicationDraftProvider extends MockGroundedAnswerProvider {
  override readonly providerName = "mock";
  override readonly model = "mock-communication-draft";

  constructor(
    private readonly draftOptions: MockCommunicationDraftProviderOptions = {},
  ) {
    super();
  }

  async generateCommunicationDraft(
    context: CommunicationDraftContext,
  ): Promise<CommunicationDraftResult> {
    if (this.draftOptions.errorMessage) {
      throw new Error(this.draftOptions.errorMessage);
    }
    if (this.draftOptions.result) return this.draftOptions.result;
    if (context.knowledge.length === 0 && context.products.length === 0) {
      return {
        refuse: true,
        refuseReason: "no_approved_basis",
        draftText:
          "No grounded draft is available. Review the conversation and reply manually.",
        knowledgeObjectIds: [],
        productIds: [],
      };
    }
    return {
      refuse: false,
      draftText:
        "Thank you for sharing the occasion and timing. I can help you review the approved options and arrange the next step.",
      knowledgeObjectIds: context.knowledge
        .slice(0, 2)
        .map((item) => item.knowledgeObjectId),
      productIds: context.products.slice(0, 3).map((item) => item.productId),
    };
  }

  async generateAcademyRoleplayReply(
    context: AcademyRoleplayContext,
  ): Promise<AcademyRoleplayResult> {
    const turnNumber = context.transcript.length;
    return {
      replyText: `[mock ${context.personaKey} reply #${turnNumber}] Responding to: "${context.latestAdvisorMessage.slice(0, 60)}"`,
    };
  }
}

export async function runCommunicationDraftJob(
  provider: AIProvider,
  context: CommunicationDraftContext,
): Promise<{
  readonly ok: boolean;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly result?: CommunicationDraftResult;
  readonly errorMessage?: string;
}> {
  const started = Date.now();
  try {
    if (!provider.generateCommunicationDraft) {
      throw new Error("AI provider does not support communication drafts");
    }
    const result = await provider.generateCommunicationDraft(context);
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
        error instanceof Error ? error.message : "Communication draft failed",
    };
  }
}
