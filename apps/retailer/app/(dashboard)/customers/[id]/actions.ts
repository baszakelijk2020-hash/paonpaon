"use server";

import { runAdvisorCaptureJob } from "@paon/ai";
import { requireRetailerRole } from "@paon/auth";
import {
  AdvisorCaptureRepository,
  AIGenerationRepository,
  AnalyticsRepository,
  ClientelingRepository,
  CustomerRepository,
  FitProfileCandidateRepository,
  OrderRepository,
  RetailerRepository,
  RetailerStaffRepository,
  SilhouetteAnalysisRepository,
} from "@paon/database";
import {
  asId,
  CAPTURE_BUNDLE_KINDS,
  createClientelingNoteSchema,
  PREFERRED_CARRIERS,
  type CaptureBundleKind,
  type CaptureBundleProposal,
  type PreferredCarrier,
} from "@paon/domain";
import { formatMoney } from "@paon/utils";
import { revalidatePath } from "next/cache";

import { getAIProvider } from "@/lib/ai";
import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface AIActionState {
  formError?: string;
  result?: { action: string; rationale: string };
}

/** Founder decision: OpenAI behind @paon/ai's provider-neutral interface — see docs/DECISIONS.md ADR-033. */
export async function generateNextBestAction(
  customerId: string,
  _previous: AIActionState,
  _formData: FormData,
): Promise<AIActionState> {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");

  const provider = getAIProvider();
  if (!provider) {
    return {
      formError:
        'AI is not configured on this deployment — see docs/PROJECT_STATE.md "Credentials needed".',
    };
  }

  const client = await getSupabaseServerClient();
  const customer = await new CustomerRepository(client).findById(
    asId<"CustomerId">(customerId),
  );
  if (!customer || customer.retailerId !== session.retailerId) {
    return { formError: "Customer not found." };
  }

  const [retailer, staff, events, orders] = await Promise.all([
    new RetailerRepository(client).findById(session.retailerId),
    new RetailerStaffRepository(client).findByUserId(session.userId),
    new AnalyticsRepository(client).findRecentByCustomer(
      session.retailerId,
      customer.id,
      10,
    ),
    new OrderRepository(client).findByCustomer(customer.id),
  ]);

  const context = {
    retailerName: retailer?.displayName ?? "the retailer",
    customerName: customer.fullName,
    lifecycleStage: customer.lifecycleStage,
    recentEventNames: events.map((event) => event.name),
    recentOrderSummaries: orders
      .slice(0, 5)
      .map(
        (order) =>
          `${order.orderNumber}: ${formatMoney(order.total, "en-US")} (${order.status})`,
      ),
  };
  const inputSummary = `customer=${customer.fullName} events=${context.recentEventNames.length} orders=${context.recentOrderSummaries.length}`;

  const generationRepo = new AIGenerationRepository(client);
  const startedAt = Date.now();

  try {
    const result = await provider.generateNextBestAction(context);
    await generationRepo.record({
      retailerId: session.retailerId,
      customerId: customer.id,
      ...(staff ? { requestedByStaffId: staff.id } : {}),
      kind: "next_best_action",
      status: "succeeded",
      provider: provider.providerName,
      model: provider.model,
      inputSummary,
      output: { action: result.action, rationale: result.rationale },
      latencyMs: Date.now() - startedAt,
    });
    revalidatePath(`/customers/${customerId}`);
    return { result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI generation failed";
    await generationRepo.record({
      retailerId: session.retailerId,
      customerId: customer.id,
      ...(staff ? { requestedByStaffId: staff.id } : {}),
      kind: "next_best_action",
      status: "failed",
      provider: provider.providerName,
      model: provider.model,
      inputSummary,
      errorMessage: message,
      latencyMs: Date.now() - startedAt,
    });
    revalidatePath(`/customers/${customerId}`);
    return { formError: message };
  }
}

/** Retailer-staff-set — no live carrier API, this only records which
 * carrier/pickup arrangement staff intend to use for this customer,
 * shown alongside their shipping addresses. */
export async function setPreferredCarrier(formData: FormData) {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const customerId = String(formData.get("customerId"));
  const raw = String(formData.get("carrier") ?? "");
  const carrier: PreferredCarrier | null = (
    PREFERRED_CARRIERS as readonly string[]
  ).includes(raw)
    ? (raw as PreferredCarrier)
    : null;

  const client = await getSupabaseServerClient();
  const customer = await new CustomerRepository(client).findById(
    asId<"CustomerId">(customerId),
  );
  if (!customer || customer.retailerId !== session.retailerId) {
    throw new Error("Customer not found.");
  }
  await new CustomerRepository(client).updatePreferredCarrier(
    customer.id,
    carrier,
  );
  revalidatePath(`/customers/${customerId}`);
}

export async function createClientelingNote(formData: FormData) {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const value = createClientelingNoteSchema.parse({
    customerId: formData.get("customerId"),
    body: formData.get("body"),
    pinned: formData.get("pinned") === "on",
  });
  const client = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(client).findByUserId(
    session.userId,
  );
  if (!staff || staff.retailerId !== session.retailerId)
    throw new Error("Active staff membership required");
  await new ClientelingRepository(client).create({
    retailerId: session.retailerId,
    customerId: value.customerId as never,
    authorStaffId: staff.id,
    body: value.body,
    pinned: value.pinned,
  });
  revalidatePath(`/customers/${value.customerId}`);
}

export interface CaptureActionState {
  formError?: string;
  sessionId?: string;
  bundleCount?: number;
}

/**
 * A raw AI response is `unknown` on purpose (IMP-003's own split, reused
 * here) — this is the one place that turns it into typed proposals. A
 * malformed entry is dropped rather than crashing the whole extraction;
 * `checkCaptureBundleProposal` (inside `proposeBundles`) does the real
 * evidence-grounding validation afterward.
 */
function parseCaptureProposals(raw: unknown): CaptureBundleProposal[] {
  if (typeof raw !== "object" || raw === null) return [];
  const bundles = (raw as { bundles?: unknown }).bundles;
  if (!Array.isArray(bundles)) return [];

  const out: CaptureBundleProposal[] = [];
  for (const item of bundles) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    const kind = row["kind"];
    if (
      typeof kind !== "string" ||
      !(CAPTURE_BUNDLE_KINDS as readonly string[]).includes(kind)
    ) {
      continue;
    }
    if (
      typeof row["summary"] !== "string" ||
      typeof row["sourceExcerpt"] !== "string" ||
      typeof row["confidence"] !== "number" ||
      typeof row["payload"] !== "object" ||
      row["payload"] === null
    ) {
      continue;
    }
    out.push({
      kind: kind as CaptureBundleKind,
      summary: row["summary"],
      sourceExcerpt: row["sourceExcerpt"],
      confidence: row["confidence"],
      payload: row["payload"] as CaptureBundleProposal["payload"],
    });
  }
  return out;
}

/**
 * Transcribes and stores the raw note, then runs one AI extraction pass.
 * Every attempt — success or failure — is recorded through
 * `AIGenerationRepository`, the same transparency surface `next_best_action`
 * already uses, so there is no separate, hidden log for this feature.
 */
export async function captureNote(
  customerId: string,
  _previous: CaptureActionState,
  formData: FormData,
): Promise<CaptureActionState> {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");

  const rawText = String(formData.get("rawText") ?? "").trim();
  const requestedSource = String(formData.get("source") ?? "text");
  const source = requestedSource === "voice" ? "voice" : "text";
  if (rawText.length === 0) {
    return { formError: "Write or paste a note first." };
  }

  const client = await getSupabaseServerClient();
  const customer = await new CustomerRepository(client).findById(
    asId<"CustomerId">(customerId),
  );
  if (!customer || customer.retailerId !== session.retailerId) {
    return { formError: "Customer not found." };
  }
  const staff = await new RetailerStaffRepository(client).findByUserId(
    session.userId,
  );
  if (!staff) return { formError: "Active staff membership required." };

  const provider = getAIProvider();
  if (!provider) {
    return {
      formError:
        'AI is not configured on this deployment — see docs/PROJECT_STATE.md "Credentials needed".',
    };
  }

  const retailer = await new RetailerRepository(client).findById(
    session.retailerId,
  );

  const captureRepo = new AdvisorCaptureRepository(client);
  const generationRepo = new AIGenerationRepository(client);
  const captureSession = await captureRepo.startSession({
    retailerId: session.retailerId,
    staffId: staff.id,
    customerId: customer.id,
    source,
    rawText,
  });

  const startedAt = Date.now();
  const result = await runAdvisorCaptureJob(provider, {
    rawText,
    retailerName: retailer?.displayName ?? "the retailer",
    customerName: customer.fullName,
    asOfDate: new Date().toISOString().slice(0, 10),
  });

  if (!result.ok) {
    await generationRepo.record({
      retailerId: session.retailerId,
      customerId: customer.id,
      requestedByStaffId: staff.id,
      kind: "advisor_capture",
      status: "failed",
      provider: result.provider,
      model: result.model,
      inputSummary: `capture session=${captureSession.id} chars=${rawText.length}`,
      errorMessage: result.errorMessage,
      latencyMs: Date.now() - startedAt,
    });
    revalidatePath(`/customers/${customerId}`);
    return { formError: result.errorMessage, sessionId: captureSession.id };
  }

  const proposals = parseCaptureProposals(result.rawOutput);
  const bundles = await captureRepo.proposeBundles({
    retailerId: session.retailerId,
    session: captureSession,
    proposals,
  });

  await generationRepo.record({
    retailerId: session.retailerId,
    customerId: customer.id,
    requestedByStaffId: staff.id,
    kind: "advisor_capture",
    status: "succeeded",
    provider: result.provider,
    model: result.model,
    inputSummary: `capture session=${captureSession.id} chars=${rawText.length}`,
    output: { bundleCount: bundles.length, proposedCount: proposals.length },
    latencyMs: Date.now() - startedAt,
  });

  revalidatePath(`/customers/${customerId}`);
  return { sessionId: captureSession.id, bundleCount: bundles.length };
}

export interface BundleActionState {
  formError?: string;
}

const CONFIRM_REJECTION_MESSAGES: Record<string, string> = {
  not_found: "That suggestion could not be found.",
  already_resolved: "That suggestion was already confirmed or dismissed.",
  no_active_membership:
    "This customer has no active HighMaintenance/Preferred Tailoring membership to book care against.",
};

export async function confirmCaptureBundle(
  customerId: string,
  _previous: BundleActionState,
  formData: FormData,
): Promise<BundleActionState> {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const bundleId = String(formData.get("bundleId") ?? "");
  if (!bundleId) return { formError: "Missing suggestion id." };

  const client = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(client).findByUserId(
    session.userId,
  );
  if (!staff) return { formError: "Active staff membership required." };

  const result = await new AdvisorCaptureRepository(client).confirmBundle({
    retailerId: session.retailerId,
    customerId: asId<"CustomerId">(customerId),
    bundleId,
    staffId: staff.id,
  });
  if (!result.ok) {
    return {
      formError:
        CONFIRM_REJECTION_MESSAGES[result.reason] ??
        "That could not be recorded.",
    };
  }
  revalidatePath(`/customers/${customerId}`);
  return {};
}

export async function dismissCaptureBundle(
  customerId: string,
  _previous: BundleActionState,
  formData: FormData,
): Promise<BundleActionState> {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const bundleId = String(formData.get("bundleId") ?? "");
  if (!bundleId) return { formError: "Missing suggestion id." };

  const client = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(client).findByUserId(
    session.userId,
  );
  if (!staff) return { formError: "Active staff membership required." };

  const result = await new AdvisorCaptureRepository(client).dismissBundle({
    retailerId: session.retailerId,
    bundleId,
    staffId: staff.id,
  });
  if (!result.ok) {
    return {
      formError:
        CONFIRM_REJECTION_MESSAGES[result.reason] ??
        "That could not be recorded.",
    };
  }
  revalidatePath(`/customers/${customerId}`);
  return {};
}

/** FT-02's advisor review decision — the human step, never mutating any
 * approved-fit/measurement record. `decide_silhouette_analysis_candidate`
 * itself enforces `is_alterations_advisor()` server-side; this action
 * doesn't duplicate that check, just surfaces its rejection honestly. */
export async function decideSilhouetteAnalysisCandidate(
  customerId: string,
  formData: FormData,
): Promise<void> {
  await requireModuleSession("wardrobe_styling");
  const sessionId = String(formData.get("sessionId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!sessionId || (decision !== "approved" && decision !== "rejected")) {
    return;
  }

  const client = await getSupabaseServerClient();
  await new SilhouetteAnalysisRepository(client).decideCandidate(
    asId<"SilhouetteAnalysisSessionId">(sessionId),
    decision,
  );
  revalidatePath(`/customers/${customerId}`);
}

export interface DecideFitProfileCandidateState {
  formError?: string;
  decided?: {
    candidateId: string;
    decision: "approved" | "rejected";
  };
}

/** FT-01's advisor review decision for a proposed fit profile candidate.
 * `approve_fit_profile_candidate`/`reject_fit_profile_candidate` enforce
 * `is_alterations_advisor()` server-side; this action doesn't duplicate
 * that check, just surfaces its rejection honestly. Returns which
 * candidate/decision settled so the client can update that one card's
 * status locally from the action's own return value, rather than
 * depending on a full page data refresh to reflect it. */
export async function decideFitProfileCandidate(
  customerId: string,
  _prevState: DecideFitProfileCandidateState,
  formData: FormData,
): Promise<DecideFitProfileCandidateState> {
  await requireModuleSession("garment_service_operations");
  const candidateId = String(formData.get("candidateId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!candidateId || (decision !== "approved" && decision !== "rejected")) {
    return { formError: "Invalid decision." };
  }

  try {
    const client = await getSupabaseServerClient();
    const repo = new FitProfileCandidateRepository(client);
    if (decision === "approved") {
      await repo.approve(asId<"FitProfileCandidateId">(candidateId));
    } else {
      await repo.reject(asId<"FitProfileCandidateId">(candidateId));
    }
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Could not decide.",
    };
  }
  revalidatePath(`/customers/${customerId}`);
  return { decided: { candidateId, decision } };
}
