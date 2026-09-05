"use server";

import {
  AIGenerationRepository,
  AnalyticsRepository,
  CustomerConsentRepository,
  CustomerRepository,
  TableServiceGuidanceRepository,
} from "@paon/database";
import {
  asId,
  mayCapturePersonalizationForCustomer,
  refuseGroundedAnswer,
  retentionExpiresAt,
  type ConversationIntent,
  type GroundedAnswer,
  type GroundedCitation,
  type GroundedShortlistItem,
} from "@paon/domain";

import { getAIProvider } from "@/lib/ai";
import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface TableServiceGuidanceActionResult {
  readonly ok: boolean;
  readonly chatLines: readonly string[];
  readonly swipePath?: string;
  readonly appointmentPath?: string;
  readonly messagesPath?: string;
  readonly answerStatus?: string;
  readonly error?: string;
}

const INTENTS = new Set<ConversationIntent>([
  "wedding",
  "shirts",
  "style_help",
  "freeform",
]);

function mapProviderAnswer(args: {
  readonly refuse: boolean;
  readonly refuseReason?: string;
  readonly answerText: string;
  readonly uncertaintyNote?: string;
  readonly knowledgeObjectIds: readonly string[];
  readonly productIds: readonly string[];
  readonly knowledgeById: ReadonlyMap<
    string,
    { readonly title: string; readonly summary: string }
  >;
  readonly shortlist: readonly GroundedShortlistItem[];
}): GroundedAnswer {
  if (args.refuse) {
    return refuseGroundedAnswer(
      args.refuseReason === "unsupported_question"
        ? "unsupported_question"
        : "no_approved_basis",
      args.answerText,
    );
  }

  const shortlistById = new Map(
    args.shortlist.map((item) => [item.productId as string, item]),
  );
  const citations: GroundedCitation[] = [];
  for (const id of args.knowledgeObjectIds) {
    const meta = args.knowledgeById.get(id);
    if (!meta) continue;
    citations.push({
      kind: "knowledge",
      id: asId<"KnowledgeObjectId">(id),
      title: meta.title,
      excerpt: meta.summary.slice(0, 180),
    });
  }
  for (const id of args.productIds) {
    const item = shortlistById.get(id);
    if (!item) continue;
    citations.push({
      kind: "product",
      id: item.productId,
      title: item.name,
      excerpt: item.explanation,
    });
  }

  return {
    status: citations.length === 0 ? "uncertain" : "answered",
    answerText: args.answerText,
    ...(args.uncertaintyNote
      ? { uncertaintyNote: args.uncertaintyNote }
      : {
          uncertaintyNote:
            "In-store fabric books and advisor expertise refine the final choice.",
        }),
    citations,
    handoffRecommended: true,
  };
}

/**
 * Grounded TableService occasion guidance (ADV-001 / ADV-002). Works for
 * anonymous visitors with deterministic retrieval; uses AI when configured;
 * records consented advisor_question events for signed-in customers only.
 */
export async function requestTableServiceGuidance(args: {
  readonly retailerId: string;
  readonly slug: string;
  readonly intent?: string;
  readonly caption?: string;
  readonly freeText?: string;
  readonly question?: string;
}): Promise<TableServiceGuidanceActionResult> {
  const intent =
    args.intent && INTENTS.has(args.intent as ConversationIntent)
      ? (args.intent as ConversationIntent)
      : undefined;

  const supabase = await getSupabaseServerClient();
  const session = await getSession();
  const retailerId = asId<"RetailerId">(args.retailerId);
  const guidanceRepo = new TableServiceGuidanceRepository(supabase);

  const retrieval = await guidanceRepo.retrieveBasis({
    retailerId,
    slug: args.slug,
    ...(intent ? { intent } : {}),
    ...(args.caption ? { caption: args.caption } : {}),
    ...(args.freeText ? { freeText: args.freeText } : {}),
  });

  if (!retrieval) {
    return {
      ok: false,
      chatLines: [
        "I don't have approved knowledge for this retailer yet. Please message an advisor.",
      ],
      messagesPath: "/messages",
      error: "Retailer unavailable",
    };
  }

  let aiAnswer: GroundedAnswer | undefined;
  const provider = getAIProvider();
  const isSignedInCustomer = session?.accountType === "customer";

  if (provider) {
    const question =
      args.question?.trim() ||
      args.freeText?.trim() ||
      `Guidance for ${retrieval.occasionLabel}`;
    try {
      const started = Date.now();
      const raw = await provider.generateGroundedAnswer({
        retailerName: retrieval.retailerName,
        question,
        occasionLabel: retrieval.occasionLabel,
        knowledge: retrieval.knowledgeResults.map((result) => ({
          knowledgeObjectId: result.knowledgeObjectId,
          title: result.presentation.title,
          summary: result.presentation.summary,
        })),
        products: retrieval.shortlist.map((item) => ({
          productId: item.productId,
          name: item.name,
          explanation: item.explanation,
        })),
      });
      const latencyMs = Date.now() - started;
      aiAnswer = mapProviderAnswer({
        refuse: raw.refuse,
        ...(raw.refuseReason ? { refuseReason: raw.refuseReason } : {}),
        answerText: raw.answerText,
        ...(raw.uncertaintyNote
          ? { uncertaintyNote: raw.uncertaintyNote }
          : {}),
        knowledgeObjectIds: raw.knowledgeObjectIds,
        productIds: raw.productIds,
        knowledgeById: retrieval.knowledgeById,
        shortlist: retrieval.shortlist,
      });

      if (isSignedInCustomer) {
        try {
          await new AIGenerationRepository(
            supabase,
          ).recordTableserviceGroundedAsCustomer({
            retailerId,
            status: "succeeded",
            provider: provider.providerName,
            model: provider.model,
            inputSummary: `TableService grounded: ${retrieval.occasionQuery}`,
            output: {
              refuse: raw.refuse,
              knowledgeObjectIds: [...raw.knowledgeObjectIds],
              productIds: [...raw.productIds],
              answerText: raw.answerText,
            },
            latencyMs,
          });
        } catch {
          // Best-effort audit.
        }
      }
    } catch (error) {
      if (isSignedInCustomer) {
        try {
          await new AIGenerationRepository(
            supabase,
          ).recordTableserviceGroundedAsCustomer({
            retailerId,
            status: "failed",
            provider: provider.providerName,
            model: provider.model,
            inputSummary: `TableService grounded: ${retrieval.occasionQuery}`,
            errorMessage:
              error instanceof Error ? error.message : "Grounded answer failed",
          });
        } catch {
          // Best-effort audit.
        }
      }
    }
  }

  const result = await guidanceRepo.projectGuidance({
    retailerId,
    slug: args.slug,
    ...(intent ? { intent } : {}),
    ...(args.caption ? { caption: args.caption } : {}),
    ...(args.freeText ? { freeText: args.freeText } : {}),
    ...(args.question ? { question: args.question } : {}),
    ...(aiAnswer ? { aiAnswer } : {}),
  });

  if (isSignedInCustomer && session) {
    try {
      const customers = await new CustomerRepository(supabase).findByUserId(
        session.userId,
      );
      const customer = customers.find((c) => c.retailerId === retailerId);
      if (customer) {
        const consentRepo = new CustomerConsentRepository(supabase);
        const consentState = await consentRepo.getState(
          retailerId,
          customer.id,
        );
        if (mayCapturePersonalizationForCustomer(consentState)) {
          const occurredAt = new Date().toISOString();
          const consentSnapshot = await consentRepo.snapshotForCapture(
            retailerId,
            customer.id,
            occurredAt,
          );
          await new AnalyticsRepository(supabase).capture({
            retailerId,
            customerId: customer.id,
            name: "advisor_question",
            properties: {
              via: "tableservice",
              occasionQuery: retrieval.occasionQuery,
              answerStatus: result.plan.answer.status,
              shortlistProductIds: result.plan.shortlist.map(
                (item) => item.productId,
              ),
              knowledgeObjectIds: result.plan.knowledgeCards.map(
                (card) => card.knowledgeObjectId,
              ),
            },
            occurredAt,
            source: "customer_portal",
            purpose: "personalization",
            consentBasis: "explicit_opt_in",
            consentSnapshot,
            retentionClass: "personalization_signal",
            retentionExpiresAt: retentionExpiresAt({ occurredAt }),
          });
        }
      }
    } catch {
      // Consent withdrawal / capture failures must not block guidance.
    }
  }

  return {
    ok: true,
    chatLines: result.chatLines,
    swipePath: result.plan.swipePath,
    appointmentPath: result.plan.appointmentPath,
    messagesPath: result.plan.messagesPath,
    answerStatus: result.plan.answer.status,
  };
}
