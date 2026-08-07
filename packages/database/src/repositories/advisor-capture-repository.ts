/**
 * Advisor capture (frictionless note/voice/photo → confirmable action
 * bundles). Persistence over `@paon/domain`'s `checkCaptureBundleProposal`
 * — every proposed bundle is validated, including that its cited
 * `sourceExcerpt` is a real substring of the note, before it is ever
 * stored or shown to an advisor. Nothing writes to `customer_facts` or
 * `clienteling_opportunities` until `confirmBundle` runs, and that method
 * requires the confirming staff id explicitly — there is no path from
 * "AI proposed it" straight to "canonical record changed."
 */

import {
  checkCaptureBundleProposal,
  type AppointmentId,
  type AppointmentProposalPayload,
  type CaptureBundleKind,
  type CaptureBundleProposal,
  type CaptureBundleStatus,
  type CaptureSource,
  type CustomerId,
  type FollowUpPayload,
  type RetailerId,
  type SelfPortraitFactPayload,
  type StaffId,
  type TaskNotePayload,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

import { AppointmentRepository } from "./appointment-repository";
import { ClientelingOpportunityRepository } from "./clienteling-opportunity-repository";
import { ClientelingRepository } from "./clienteling-repository";
import { CustomerFactRepository } from "./customer-fact-repository";

type SessionRow =
  Database["public"]["Tables"]["advisor_capture_sessions"]["Row"];
type BundleRow = Database["public"]["Tables"]["advisor_capture_bundles"]["Row"];

const PROJECTOR_VERSION = "advisor-capture-v1";

export interface AdvisorCaptureSession {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly staffId: StaffId;
  readonly customerId: CustomerId | null;
  readonly appointmentId: AppointmentId | null;
  readonly source: CaptureSource;
  readonly rawText: string;
  readonly createdAt: string;
}

export interface AdvisorCaptureBundle {
  readonly id: string;
  readonly captureSessionId: string;
  readonly kind: CaptureBundleKind;
  readonly summary: string;
  readonly sourceExcerpt: string;
  readonly confidence: number;
  readonly payload: CaptureBundleProposal["payload"];
  readonly status: CaptureBundleStatus;
  readonly linkedFactId: string | null;
  readonly linkedOpportunityId: string | null;
  readonly linkedNoteId: string | null;
  readonly linkedAppointmentId: string | null;
  readonly createdAt: string;
}

function sessionToDomain(row: SessionRow): AdvisorCaptureSession {
  return {
    id: row.id,
    retailerId: row.retailer_id as RetailerId,
    staffId: row.staff_id as StaffId,
    customerId: row.customer_id as CustomerId | null,
    appointmentId: row.appointment_id as AppointmentId | null,
    source: row.source as CaptureSource,
    rawText: row.raw_text,
    createdAt: row.created_at,
  };
}

function bundleToDomain(row: BundleRow): AdvisorCaptureBundle {
  return {
    id: row.id,
    captureSessionId: row.capture_session_id,
    kind: row.kind as CaptureBundleKind,
    summary: row.summary,
    sourceExcerpt: row.source_excerpt,
    confidence: Number(row.confidence),
    payload:
      row.proposed_payload as unknown as CaptureBundleProposal["payload"],
    status: row.status as CaptureBundleStatus,
    linkedFactId: row.linked_fact_id,
    linkedOpportunityId: row.linked_opportunity_id,
    linkedNoteId: row.linked_note_id,
    linkedAppointmentId: row.linked_appointment_id,
    createdAt: row.created_at,
  };
}

export type ConfirmBundleResult =
  | { readonly ok: true; readonly bundle: AdvisorCaptureBundle }
  | { readonly ok: false; readonly reason: "not_found" | "already_resolved" };

export class AdvisorCaptureRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async startSession(args: {
    readonly retailerId: RetailerId;
    readonly staffId: StaffId;
    readonly customerId?: CustomerId;
    readonly appointmentId?: AppointmentId;
    readonly source?: CaptureSource;
    readonly rawText: string;
  }): Promise<AdvisorCaptureSession> {
    const { data, error } = await this.client
      .from("advisor_capture_sessions")
      .insert({
        retailer_id: args.retailerId,
        staff_id: args.staffId,
        ...(args.customerId ? { customer_id: args.customerId } : {}),
        ...(args.appointmentId ? { appointment_id: args.appointmentId } : {}),
        source: args.source ?? "text",
        raw_text: args.rawText.trim(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return sessionToDomain(data);
  }

  async listSessionsForCustomer(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly limit?: number;
  }): Promise<readonly AdvisorCaptureSession[]> {
    const { data, error } = await this.client
      .from("advisor_capture_sessions")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("customer_id", args.customerId)
      .order("created_at", { ascending: false })
      .limit(args.limit ?? 5);
    if (error) throw error;
    return data.map(sessionToDomain);
  }

  /**
   * Validates every proposal against the session's own raw text —
   * `checkCaptureBundleProposal` refuses a bundle whose excerpt is not
   * really there — and stores only the ones that pass. A proposal that
   * fails validation is dropped silently rather than shown as a
   * reviewable suggestion: it was never real evidence to begin with.
   */
  async proposeBundles(args: {
    readonly retailerId: RetailerId;
    readonly session: AdvisorCaptureSession;
    readonly proposals: readonly CaptureBundleProposal[];
  }): Promise<readonly AdvisorCaptureBundle[]> {
    const valid = args.proposals.filter(
      (proposal) =>
        checkCaptureBundleProposal({
          rawText: args.session.rawText,
          proposal,
        }).ok,
    );
    if (valid.length === 0) return [];

    const { data, error } = await this.client
      .from("advisor_capture_bundles")
      .insert(
        valid.map((proposal) => ({
          retailer_id: args.retailerId,
          capture_session_id: args.session.id,
          kind: proposal.kind,
          summary: proposal.summary.trim().slice(0, 300),
          source_excerpt: proposal.sourceExcerpt.trim().slice(0, 2000),
          confidence: proposal.confidence,
          proposed_payload: proposal.payload as unknown as Json,
        })),
      )
      .select("*");
    if (error) throw error;
    return data.map(bundleToDomain);
  }

  async listBundlesForSession(args: {
    readonly retailerId: RetailerId;
    readonly sessionId: string;
  }): Promise<readonly AdvisorCaptureBundle[]> {
    const { data, error } = await this.client
      .from("advisor_capture_bundles")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("capture_session_id", args.sessionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(bundleToDomain);
  }

  private async loadProposedBundle(
    retailerId: RetailerId,
    bundleId: string,
  ): Promise<BundleRow | null> {
    const { data, error } = await this.client
      .from("advisor_capture_bundles")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("id", bundleId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  private async markResolved(args: {
    readonly retailerId: RetailerId;
    readonly bundleId: string;
    readonly staffId: StaffId;
    readonly status: "confirmed" | "dismissed";
    readonly link: {
      readonly linked_fact_id?: string;
      readonly linked_opportunity_id?: string;
      readonly linked_note_id?: string;
      readonly linked_appointment_id?: string;
    };
    readonly editedPayload?: unknown;
    readonly editedSummary?: string;
  }): Promise<AdvisorCaptureBundle> {
    const { data, error } = await this.client
      .from("advisor_capture_bundles")
      .update({
        status: args.status,
        confirmed_by_staff_id: args.staffId,
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...args.link,
        ...(args.editedPayload !== undefined
          ? { proposed_payload: args.editedPayload as Json }
          : {}),
        ...(args.editedSummary
          ? { summary: args.editedSummary.slice(0, 300) }
          : {}),
      })
      .eq("retailer_id", args.retailerId)
      .eq("id", args.bundleId)
      .eq("status", "proposed")
      .select("*")
      .single();
    if (error) throw error;
    return bundleToDomain(data);
  }

  async dismissBundle(args: {
    readonly retailerId: RetailerId;
    readonly bundleId: string;
    readonly staffId: StaffId;
  }): Promise<ConfirmBundleResult> {
    const existing = await this.loadProposedBundle(
      args.retailerId,
      args.bundleId,
    );
    if (!existing) return { ok: false, reason: "not_found" };
    if (existing.status !== "proposed") {
      return { ok: false, reason: "already_resolved" };
    }
    const bundle = await this.markResolved({
      retailerId: args.retailerId,
      bundleId: args.bundleId,
      staffId: args.staffId,
      status: "dismissed",
      link: {},
    });
    return { ok: true, bundle };
  }

  /**
   * Confirms one bundle, writing it into the canonical table its kind
   * targets. `editedPayload`, when given, replaces the AI's proposal
   * outright — an advisor's edit is what gets written, not the original
   * suggestion next to it.
   */
  async confirmBundle(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly bundleId: string;
    readonly staffId: StaffId;
    readonly editedPayload?: CaptureBundleProposal["payload"];
    readonly editedSummary?: string;
  }): Promise<ConfirmBundleResult> {
    const existing = await this.loadProposedBundle(
      args.retailerId,
      args.bundleId,
    );
    if (!existing) return { ok: false, reason: "not_found" };
    if (existing.status !== "proposed") {
      return { ok: false, reason: "already_resolved" };
    }

    const summary = args.editedSummary ?? existing.summary;
    const payload = (args.editedPayload ??
      existing.proposed_payload) as unknown as CaptureBundleProposal["payload"];
    const kind = existing.kind as CaptureBundleKind;

    if (kind === "self_portrait_fact") {
      const fact = payload as SelfPortraitFactPayload;
      const created = await new CustomerFactRepository(this.client).record({
        retailerId: args.retailerId,
        customerId: args.customerId,
        staffId: args.staffId,
        factType: fact.factType,
        valueLabel: fact.valueLabel,
        confidence: Number(existing.confidence),
        evidence: [{ note: existing.source_excerpt }],
      });
      const bundle = await this.markResolved({
        retailerId: args.retailerId,
        bundleId: args.bundleId,
        staffId: args.staffId,
        status: "confirmed",
        link: { linked_fact_id: created.id },
        editedPayload: args.editedPayload,
        ...(args.editedSummary ? { editedSummary: summary } : {}),
      });
      return { ok: true, bundle };
    }

    if (kind === "follow_up") {
      const followUp = payload as FollowUpPayload;
      const created = await new ClientelingOpportunityRepository(
        this.client,
      ).create({
        retailerId: args.retailerId,
        customerId: args.customerId,
        type: "advisor_commitment",
        whyNow: followUp.whyNow,
        suggestedAction: followUp.suggestedAction,
        channel: followUp.channel ?? "in_person",
        assignedStaffId: args.staffId,
        ...(followUp.dueAt ? { dueAt: followUp.dueAt } : {}),
        confidence: Number(existing.confidence),
        evidence: [{ note: existing.source_excerpt }],
        projectorVersion: PROJECTOR_VERSION,
      });
      const bundle = await this.markResolved({
        retailerId: args.retailerId,
        bundleId: args.bundleId,
        staffId: args.staffId,
        status: "confirmed",
        link: { linked_opportunity_id: created.id },
        editedPayload: args.editedPayload,
        ...(args.editedSummary ? { editedSummary: summary } : {}),
      });
      return { ok: true, bundle };
    }

    if (kind === "task_note") {
      const note = payload as TaskNotePayload;
      const created = await new ClientelingRepository(this.client).create({
        retailerId: args.retailerId,
        customerId: args.customerId,
        authorStaffId: args.staffId,
        body: note.note,
        pinned: false,
      });
      const bundle = await this.markResolved({
        retailerId: args.retailerId,
        bundleId: args.bundleId,
        staffId: args.staffId,
        status: "confirmed",
        link: { linked_note_id: created.id },
        editedPayload: args.editedPayload,
        ...(args.editedSummary ? { editedSummary: summary } : {}),
      });
      return { ok: true, bundle };
    }

    if (kind === "appointment_proposal") {
      const proposal = payload as AppointmentProposalPayload;
      const startsAt = new Date(proposal.startsAt);
      const endsAt = new Date(
        startsAt.getTime() + proposal.durationMinutes * 60_000,
      );
      const created = await new AppointmentRepository(this.client).create({
        retailerId: args.retailerId,
        customerId: args.customerId,
        type: proposal.appointmentType,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        staffId: args.staffId,
        notes: `From conversation capture: ${proposal.reason}`,
      });
      const bundle = await this.markResolved({
        retailerId: args.retailerId,
        bundleId: args.bundleId,
        staffId: args.staffId,
        status: "confirmed",
        link: { linked_appointment_id: created.id },
        editedPayload: args.editedPayload,
        ...(args.editedSummary ? { editedSummary: summary } : {}),
      });
      return { ok: true, bundle };
    }

    // unresolved: never has a write target — nothing to confirm. The
    // review UI only ever offers "Acknowledge" (dismissBundle) for this
    // kind; this is the server-side backstop against a stray confirm call.
    return { ok: false, reason: "already_resolved" };
  }
}
