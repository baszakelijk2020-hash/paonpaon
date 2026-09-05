"use client";

import type { SilhouetteAnalysisCaptureWithUrl } from "@paon/database";
import {
  canWithdrawSilhouetteAnalysisConsent,
  type RetailerId,
  type SilhouetteAnalysisSession,
} from "@paon/domain";
import { Button, buttonVariants } from "@paon/ui/components/Button";
import { useActionState } from "react";

import {
  confirmSilhouetteAnalysisCandidate,
  startSilhouetteAnalysisSession,
  uploadSilhouetteCapture,
  withdrawSilhouetteAnalysisConsent,
  type UploadCaptureState,
} from "./actions";

const STATUS_COPY: Record<SilhouetteAnalysisSession["status"], string> = {
  consented: "Ready when you are — take or choose a photo below.",
  capturing: "Ready when you are — take or choose a photo below.",
  candidate: "Sent to your advisor for review.",
  advisor_reviewed: "Your advisor has reviewed your photo.",
  customer_confirmed: "Confirmed.",
  rejected: "Not proceeding with this one.",
  expired: "This request expired.",
};

const initialUploadState: UploadCaptureState = {};

export function SilhouetteAnalysisPanel({
  retailerId,
  session,
  captures,
}: {
  retailerId: RetailerId;
  session: SilhouetteAnalysisSession | null;
  captures: readonly SilhouetteAnalysisCaptureWithUrl[];
}) {
  const boundUpload = session
    ? uploadSilhouetteCapture.bind(null, session.id, retailerId)
    : null;
  const [uploadState, uploadAction, isUploading] = useActionState(
    boundUpload ?? (async (s: UploadCaptureState) => s),
    initialUploadState,
  );

  if (
    !session ||
    session.status === "customer_confirmed" ||
    session.status === "rejected" ||
    session.status === "expired"
  ) {
    return (
      <div className="flex flex-col gap-2">
        {session ? (
          <p className="text-sm text-[var(--color-stone-600)]" role="status">
            {STATUS_COPY[session.status]}
            {session.status === "rejected" && session.rejectedReason
              ? session.rejectedReason === "customer_withdrew"
                ? " You withdrew this request."
                : " Your advisor did not approve this photo."
              : ""}
          </p>
        ) : null}
        <form action={startSilhouetteAnalysisSession}>
          <input type="hidden" name="retailerId" value={retailerId} />
          <Button type="submit" size="sm">
            {session
              ? "Start a new silhouette analysis"
              : "Start silhouette analysis"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--color-stone-600)]" role="status">
        {STATUS_COPY[session.status]}
      </p>

      {captures.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {captures.map(({ capture, signedUrl }) => (
            <li key={capture.id} className="text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedUrl}
                alt="Your submission"
                className="max-h-48 rounded-[var(--radius-md)] border border-[var(--color-stone-200)]"
              />
            </li>
          ))}
        </ul>
      ) : null}

      {(session.status === "consented" || session.status === "capturing") &&
      boundUpload ? (
        <form action={uploadAction} className="flex flex-col gap-2">
          <label
            htmlFor="photo"
            className="text-sm text-[var(--color-stone-700)]"
          >
            Photo
          </label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
          />
          {uploadState.formError ? (
            <p role="alert" className="text-sm text-[var(--color-danger-500)]">
              {uploadState.formError}
            </p>
          ) : null}
          <Button type="submit" size="sm" disabled={isUploading}>
            {isUploading ? "Sending…" : "Send to my advisor"}
          </Button>
        </form>
      ) : null}

      {session.status === "advisor_reviewed" &&
      session.advisorDecision === "approved" ? (
        <form action={confirmSilhouetteAnalysisCandidate}>
          <input type="hidden" name="sessionId" value={session.id} />
          <Button type="submit" size="sm">
            Confirm
          </Button>
        </form>
      ) : null}

      {canWithdrawSilhouetteAnalysisConsent(session.status) ? (
        <form action={withdrawSilhouetteAnalysisConsent}>
          <input type="hidden" name="sessionId" value={session.id} />
          <button
            type="submit"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Withdraw
          </button>
        </form>
      ) : null}
    </div>
  );
}
