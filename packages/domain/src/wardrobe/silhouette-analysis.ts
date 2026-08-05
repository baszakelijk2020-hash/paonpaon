import type {
  CustomerId,
  RetailerId,
  SilhouetteAnalysisCaptureId,
  SilhouetteAnalysisSessionId,
  StaffId,
} from "../shared/branded-id";

/** FT-02 Silhouette analysis (docs/FOUNDER_TOOL_BLUEPRINTS.md) —
 * consent/capture session state machine. Exact states from the
 * blueprint's own State-and-wiring section. */
export const SILHOUETTE_ANALYSIS_SESSION_STATUSES = [
  "consented",
  "capturing",
  "candidate",
  "advisor_reviewed",
  "customer_confirmed",
  "rejected",
  "expired",
] as const;
export type SilhouetteAnalysisSessionStatus =
  (typeof SILHOUETTE_ANALYSIS_SESSION_STATUSES)[number];

export type SilhouetteAnalysisAdvisorDecision = "approved" | "rejected";

export type SilhouetteAnalysisRejectedReason =
  "advisor_rejected" | "customer_withdrew" | "expired_untouched";

export interface SilhouetteAnalysisSession {
  readonly id: SilhouetteAnalysisSessionId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly status: SilhouetteAnalysisSessionStatus;
  readonly consentedAt: string;
  readonly advisorReviewedByStaffId?: StaffId;
  readonly advisorReviewedAt?: string;
  readonly advisorDecision?: SilhouetteAnalysisAdvisorDecision;
  readonly advisorNote?: string;
  readonly customerConfirmedAt?: string;
  readonly rejectedReason?: SilhouetteAnalysisRejectedReason;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SilhouetteAnalysisCapture {
  readonly id: SilhouetteAnalysisCaptureId;
  readonly retailerId: RetailerId;
  readonly sessionId: SilhouetteAnalysisSessionId;
  readonly storageBucket: string;
  readonly storagePath: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
}

const TERMINAL_STATUSES: readonly SilhouetteAnalysisSessionStatus[] = [
  "customer_confirmed",
  "rejected",
  "expired",
];

/** A session in a terminal state accepts no further transitions. */
export function isSilhouetteAnalysisSessionTerminal(
  status: SilhouetteAnalysisSessionStatus,
): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Mirrors `withdraw_silhouette_analysis_consent`'s own guard — pure
 * logic so the UI can disable the withdraw action without a round
 * trip, while the RPC remains the actual enforcement boundary. */
export function canWithdrawSilhouetteAnalysisConsent(
  status: SilhouetteAnalysisSessionStatus,
): boolean {
  return !isSilhouetteAnalysisSessionTerminal(status);
}

/** Mirrors `confirm_silhouette_analysis_candidate`'s own guard: only
 * once the advisor has reviewed and approved. */
export function canCustomerConfirmSilhouetteAnalysisCandidate(
  status: SilhouetteAnalysisSessionStatus,
  advisorDecision: SilhouetteAnalysisAdvisorDecision | undefined,
): boolean {
  return status === "advisor_reviewed" && advisorDecision === "approved";
}
