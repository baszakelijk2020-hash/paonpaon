"use server";

import { runTableServiceAnswerJob } from "@paon/ai";
import {
  AIGenerationRepository,
  RetailerRepository,
  TableServiceRepository,
} from "@paon/database";
import {
  asId,
  buildDeterministicGroundedAnswer,
  buildOccasionWelcomeLines,
  validateTableServiceGroundedAnswer,
  type TableServiceGroundedAnswer,
  type TableServiceOccasionBundle,
} from "@paon/domain";

import { getAIProvider } from "@/lib/ai";
import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface OccasionGuidanceResult {
  readonly bundle: TableServiceOccasionBundle;
  readonly welcomeLines: readonly string[];
  readonly swipeHref: string;
  readonly appointmentsHref: string;
}

export interface GroundedQuestionResult {
  readonly answer: TableServiceGroundedAnswer;
  readonly source: "ai" | "deterministic";
}

function slugFromPathname(pathname: string | null): string | null {
  const match = pathname?.match(/^\/r\/([^/]+)/);
  return match?.[1] ?? null;
}

/** Loads approved knowledge + occasion shortlist for guided TableService flows. */
export async function getOccasionGuidance(
  retailerId: string,
  occasionPhrase: string,
  slug: string,
): Promise<OccasionGuidanceResult> {
  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);
  const bundle = await new TableServiceRepository(
    supabase,
  ).projectOccasionBundle(rId, occasionPhrase);
  const welcomeLines = buildOccasionWelcomeLines(bundle);
  const occasionParam = encodeURIComponent(
    occasionPhrase.trim().toLowerCase().replace(/\s+/g, "-"),
  );
  return {
    bundle,
    welcomeLines,
    swipeHref: `/r/${slug}/swipe?occasion=${occasionParam}`,
    appointmentsHref: `/r/${slug}/appointments?occasion=${occasionParam}`,
  };
}

/** Grounds a customer question in approved knowledge; falls back deterministically. */
export async function askGroundedTableServiceQuestion(
  retailerId: string,
  question: string,
  occasionPhrase?: string,
): Promise<GroundedQuestionResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    return {
      answer: {
        body: "Please ask a question and an advisor can help if needed.",
        citations: [],
        citedProductIds: [],
        uncertainty: "high",
        refused: true,
        handoffRecommended: true,
      },
      source: "deterministic",
    };
  }

  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);
  const tableServiceRepo = new TableServiceRepository(supabase);
  const bundle = await tableServiceRepo.projectOccasionBundle(
    rId,
    occasionPhrase ?? "summer wedding",
  );

  const allowed = {
    knowledgeIds: new Set(bundle.allowedKnowledgeIds.map(String)),
    productIds: new Set(bundle.allowedProductIds.map(String)),
  };

  const provider = getAIProvider();
  if (provider) {
    const retailer = await new RetailerRepository(supabase).findById(rId);
    const job = await runTableServiceAnswerJob(provider, {
      idempotencyKey: `${rId}:${trimmed.slice(0, 64)}`,
      retailerName: retailer?.displayName ?? "Your tailor",
      ...(occasionPhrase ? { occasionPhrase } : {}),
      question: trimmed,
      knowledge: bundle.knowledge.map((item) => ({
        knowledgeObjectId: item.knowledgeObjectId,
        title: item.title,
        summary: item.summary,
      })),
      shortlist: bundle.shortlist.map((item) => ({
        productId: item.productId,
        name: item.name,
        explanation: item.explanation,
      })),
    });

    const session = await getSession();
    const aiRepo = new AIGenerationRepository(supabase);

    if (job.ok) {
      const validation = validateTableServiceGroundedAnswer(
        job.rawOutput as Record<string, unknown>,
        allowed,
      );
      if (validation.ok && validation.answer) {
        if (session?.accountType === "customer") {
          try {
            await aiRepo.record({
              retailerId: rId,
              kind: "table_service_answer",
              status: "succeeded",
              provider: job.provider,
              model: job.model,
              inputSummary: trimmed.slice(0, 240),
              output: validation.answer as unknown as Record<string, unknown>,
              latencyMs: job.latencyMs,
            });
          } catch {
            // Audit must not block the customer-facing answer.
          }
        }
        return { answer: validation.answer, source: "ai" };
      }
    } else if (session?.accountType === "customer") {
      try {
        await aiRepo.record({
          retailerId: rId,
          kind: "table_service_answer",
          status: "failed",
          provider: job.provider,
          model: job.model,
          inputSummary: trimmed.slice(0, 240),
          errorMessage: job.errorMessage,
          latencyMs: job.latencyMs,
        });
      } catch {
        // Best-effort audit.
      }
    }
  }

  return {
    answer: buildDeterministicGroundedAnswer({ bundle, question: trimmed }),
    source: "deterministic",
  };
}

export { slugFromPathname };
