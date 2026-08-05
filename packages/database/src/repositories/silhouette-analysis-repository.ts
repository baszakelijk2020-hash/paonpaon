import {
  asId,
  type CustomerId,
  type RetailerId,
  type SilhouetteAnalysisAdvisorDecision,
  type SilhouetteAnalysisCapture,
  type SilhouetteAnalysisCaptureId,
  type SilhouetteAnalysisRejectedReason,
  type SilhouetteAnalysisSession,
  type SilhouetteAnalysisSessionId,
  type SilhouetteAnalysisSessionStatus,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type SessionRow =
  Database["public"]["Tables"]["silhouette_analysis_sessions"]["Row"];
type CaptureRow =
  Database["public"]["Tables"]["silhouette_analysis_captures"]["Row"];

function toSession(row: SessionRow): SilhouetteAnalysisSession {
  return {
    id: asId<"SilhouetteAnalysisSessionId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    status: row.status as SilhouetteAnalysisSessionStatus,
    consentedAt: row.consented_at,
    ...(row.advisor_reviewed_by_staff_id
      ? {
          advisorReviewedByStaffId: asId<"StaffId">(
            row.advisor_reviewed_by_staff_id,
          ),
        }
      : {}),
    ...(row.advisor_reviewed_at
      ? { advisorReviewedAt: row.advisor_reviewed_at }
      : {}),
    ...(row.advisor_decision
      ? {
          advisorDecision:
            row.advisor_decision as SilhouetteAnalysisAdvisorDecision,
        }
      : {}),
    ...(row.advisor_note ? { advisorNote: row.advisor_note } : {}),
    ...(row.customer_confirmed_at
      ? { customerConfirmedAt: row.customer_confirmed_at }
      : {}),
    ...(row.rejected_reason
      ? {
          rejectedReason:
            row.rejected_reason as SilhouetteAnalysisRejectedReason,
        }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCapture(row: CaptureRow): SilhouetteAnalysisCapture {
  return {
    id: asId<"SilhouetteAnalysisCaptureId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    sessionId: asId<"SilhouetteAnalysisSessionId">(row.session_id),
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

export interface SilhouetteAnalysisCaptureWithUrl {
  readonly capture: SilhouetteAnalysisCapture;
  readonly signedUrl: string;
}

/** FT-02's consent/capture session state machine
 * (docs/FOUNDER_TOOL_BLUEPRINTS.md). Every write goes through the
 * narrow RPCs in migration `20260805230000` — this repository never
 * inserts/updates the session or capture rows directly. */
export class SilhouetteAnalysisRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /** Customer's explicit consent starts the session — no covert
   * camera start, matching the blueprint's own trust boundary. */
  async startSession(
    retailerId: RetailerId,
  ): Promise<SilhouetteAnalysisSessionId> {
    const { data, error } = await this.client.rpc(
      "start_silhouette_analysis_session",
      { p_retailer_id: retailerId },
    );
    if (error) throw error;
    return asId<"SilhouetteAnalysisSessionId">(data);
  }

  async beginCapture(sessionId: SilhouetteAnalysisSessionId): Promise<void> {
    const { error } = await this.client.rpc("begin_silhouette_capture", {
      p_session_id: sessionId,
    });
    if (error) throw error;
  }

  /** Uploads the capture bytes to the private bucket, then records it —
   * same two-step shape as `MessagingRepository.uploadAttachment`
   * (upload first, RPC re-validates the object actually exists at the
   * claimed path before accepting it). */
  async uploadCapture(
    sessionId: SilhouetteAnalysisSessionId,
    values: {
      retailerId: RetailerId;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      content: ArrayBuffer;
    },
  ): Promise<SilhouetteAnalysisCaptureId> {
    const storagePath = `${values.retailerId}/${sessionId}/${crypto.randomUUID()}-${values.fileName}`;
    const { error: uploadError } = await this.client.storage
      .from("silhouette-evidence")
      .upload(storagePath, values.content, {
        contentType: values.mimeType,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data, error } = await this.client.rpc("record_silhouette_capture", {
      p_session_id: sessionId,
      p_storage_path: storagePath,
      p_file_name: values.fileName,
      p_mime_type: values.mimeType,
      p_size_bytes: values.sizeBytes,
    });
    if (error) throw error;
    return asId<"SilhouetteAnalysisCaptureId">(data);
  }

  async withdrawConsent(sessionId: SilhouetteAnalysisSessionId): Promise<void> {
    const { error } = await this.client.rpc(
      "withdraw_silhouette_analysis_consent",
      { p_session_id: sessionId },
    );
    if (error) throw error;
  }

  /** Advisor-only. Never touches any approved-fit/measurement record —
   * the blueprint's own stated boundary. */
  async decideCandidate(
    sessionId: SilhouetteAnalysisSessionId,
    decision: SilhouetteAnalysisAdvisorDecision,
    note?: string,
  ): Promise<void> {
    const { error } = await this.client.rpc(
      "decide_silhouette_analysis_candidate",
      {
        p_session_id: sessionId,
        p_decision: decision,
        ...(note ? { p_note: note } : {}),
      },
    );
    if (error) throw error;
  }

  async confirmCandidate(
    sessionId: SilhouetteAnalysisSessionId,
  ): Promise<void> {
    const { error } = await this.client.rpc(
      "confirm_silhouette_analysis_candidate",
      { p_session_id: sessionId },
    );
    if (error) throw error;
  }

  /** The caller's own most recent session for this retailer, for the
   * "My silhouette analysis" surface. */
  async findLatestSessionForCustomer(
    retailerId: RetailerId,
  ): Promise<SilhouetteAnalysisSession | null> {
    const { data, error } = await this.client
      .from("silhouette_analysis_sessions")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toSession(data) : null;
  }

  /** Retailer-side: one specific customer's sessions, for the advisor
   * review card on the customer detail page. */
  async findSessionsByCustomer(
    customerId: CustomerId,
  ): Promise<SilhouetteAnalysisSession[]> {
    const { data, error } = await this.client
      .from("silhouette_analysis_sessions")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toSession);
  }

  async findSessionById(
    sessionId: SilhouetteAnalysisSessionId,
  ): Promise<SilhouetteAnalysisSession | null> {
    const { data, error } = await this.client
      .from("silhouette_analysis_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return data ? toSession(data) : null;
  }

  /** Sessions awaiting advisor review, for the retailer review queue —
   * matches the actors model ("trained advisor reviews"). */
  async findCandidateSessionsByRetailer(
    retailerId: RetailerId,
  ): Promise<SilhouetteAnalysisSession[]> {
    const { data, error } = await this.client
      .from("silhouette_analysis_sessions")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("status", "candidate")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(toSession);
  }

  async findCapturesForSessionWithUrls(
    sessionId: SilhouetteAnalysisSessionId,
  ): Promise<SilhouetteAnalysisCaptureWithUrl[]> {
    const { data, error } = await this.client
      .from("silhouette_analysis_captures")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) throw error;

    return Promise.all(
      data.map(async (row) => {
        const capture = toCapture(row);
        const { data: signed, error: signedError } = await this.client.storage
          .from(capture.storageBucket)
          .createSignedUrl(capture.storagePath, 15 * 60);
        if (signedError) throw signedError;
        return { capture, signedUrl: signed.signedUrl };
      }),
    );
  }
}
