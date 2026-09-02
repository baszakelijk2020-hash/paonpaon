"use client";

import type {
  FitArchetypeOption,
  StylePortrait,
  StylePortraitConsent,
  WardrobeVisualizationJob,
} from "@paon/domain";
import { Button, buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState } from "react";

import {
  approveStylePortrait,
  declareFitArchetype,
  generateStylePortraitPreview,
  grantStylePortraitConsent,
  restartStylePortrait,
  uploadStylePortraitReference,
  withdrawStylePortraitConsent,
  type UploadReferenceState,
} from "./style-portrait-actions";

const initialUploadState: UploadReferenceState = {};

function UploadForm({
  retailerId,
  kind,
  label,
  done,
}: {
  retailerId: string;
  kind: "face" | "full_body";
  label: string;
  done: boolean;
}) {
  const boundUpload = uploadStylePortraitReference.bind(null, retailerId, kind);
  const [state, formAction, isUploading] = useActionState(
    boundUpload,
    initialUploadState,
  );
  const inputId = `style-portrait-photo-${kind}`;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="text-sm text-[var(--color-stone-700)]"
      >
        {label}{" "}
        {done ? (
          <span className="text-[var(--color-success-500)]">✓ received</span>
        ) : null}
      </label>
      <input
        id={inputId}
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
      />
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        disabled={isUploading}
      >
        {isUploading ? "Uploading…" : done ? "Replace photo" : "Upload"}
      </Button>
    </form>
  );
}

export function StylePortraitPanel({
  retailerId,
  retailerName,
  consent,
  portrait,
  previewJob,
  fitArchetypes,
}: {
  retailerId: string;
  retailerName: string;
  consent: StylePortraitConsent;
  portrait: StylePortrait | null;
  previewJob: WardrobeVisualizationJob | null;
  fitArchetypes: readonly FitArchetypeOption[];
}) {
  const consentGranted =
    consent.status === "granted" && consent.disclosuresAcknowledged;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Style Portrait — {retailerName}
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Two reference photos and a fit preference so this studio can show you
          wearing pieces from your wardrobe. AI visualizations only — never a
          guarantee of physical fit.
        </p>
      </div>

      {!consentGranted ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-4">
          <ul className="list-disc space-y-1 pl-4 text-sm text-[var(--color-stone-600)]">
            <li>
              We need a face and full-body photo to render you in outfits.
            </li>
            <li>
              Your assigned advisor at {retailerName} can see these photos and
              the generated looks.
            </li>
            <li>
              Every result is an AI visualization, not a guarantee of fit.
            </li>
            <li>You can delete your photos and revoke this at any time.</li>
          </ul>
          <form action={grantStylePortraitConsent}>
            <input type="hidden" name="retailerId" value={retailerId} />
            <Button type="submit" size="sm">
              I understand — continue
            </Button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {portrait?.status === "approved" ? (
            <div className="flex flex-col gap-3">
              <p
                className="text-sm text-[var(--color-success-500)]"
                role="status"
              >
                Your Style Portrait is approved and ready for the Virtual
                Studio.
              </p>
              {previewJob?.outputImageUrl || portrait.previewImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewJob?.outputImageUrl ?? portrait.previewImageUrl}
                  alt="Your Style Portrait reference"
                  className="max-h-64 rounded-[var(--radius-md)] border border-[var(--color-stone-200)]"
                />
              ) : null}
              <form action={restartStylePortrait}>
                <input type="hidden" name="retailerId" value={retailerId} />
                <button
                  type="submit"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Use different photos
                </button>
              </form>
            </div>
          ) : portrait?.status === "preview_generated" ? (
            <div className="flex flex-col gap-3">
              <p
                className="text-sm text-[var(--color-stone-600)]"
                role="status"
              >
                Check your photo, then approve to activate your Style Portrait.
              </p>
              {previewJob?.outputImageUrl || portrait.previewImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewJob?.outputImageUrl ?? portrait.previewImageUrl}
                  alt="Your Style Portrait reference"
                  className="max-h-64 rounded-[var(--radius-md)] border border-[var(--color-stone-200)]"
                />
              ) : null}
              <div className="flex gap-2">
                <form action={approveStylePortrait}>
                  <input type="hidden" name="retailerId" value={retailerId} />
                  <Button type="submit" size="sm">
                    Approve
                  </Button>
                </form>
                <form action={restartStylePortrait}>
                  <input type="hidden" name="retailerId" value={retailerId} />
                  <button
                    type="submit"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Use another photo
                  </button>
                </form>
              </div>
            </div>
          ) : previewJob?.status === "queued" ||
            previewJob?.status === "generating" ? (
            <p className="text-sm text-[var(--color-stone-600)]" role="status">
              {previewJob.status === "queued"
                ? "Your neutral Style Portrait is queued."
                : "Creating your neutral Style Portrait…"}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <UploadForm
                  retailerId={retailerId}
                  kind="face"
                  label="Face photo"
                  done={
                    portrait?.references.some((ref) => ref.kind === "face") ??
                    false
                  }
                />
                <UploadForm
                  retailerId={retailerId}
                  kind="full_body"
                  label="Full-body photo"
                  done={
                    portrait?.references.some(
                      (ref) => ref.kind === "full_body",
                    ) ?? false
                  }
                />
              </div>

              {fitArchetypes.length > 0 ? (
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-stone-700)]">
                    Fit preference
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fitArchetypes.map((archetype) => (
                      <form
                        key={archetype.conceptId}
                        action={declareFitArchetype.bind(
                          null,
                          retailerId,
                          archetype.conceptId,
                        )}
                      >
                        <button
                          type="submit"
                          className={buttonVariants({
                            variant:
                              portrait?.fitArchetypeConceptId ===
                              archetype.conceptId
                                ? "primary"
                                : "outline",
                            size: "sm",
                          })}
                          title={archetype.description}
                        >
                          {archetype.label}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              ) : null}

              <form action={generateStylePortraitPreview}>
                <input type="hidden" name="retailerId" value={retailerId} />
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    !portrait?.references.some((ref) => ref.kind === "face") ||
                    !portrait?.references.some(
                      (ref) => ref.kind === "full_body",
                    ) ||
                    !portrait.fitArchetypeConceptId
                  }
                >
                  {previewJob?.status === "failed" ? "Try again" : "Continue"}
                </Button>
                {previewJob?.status === "failed" ? (
                  <p className="mt-2 text-sm text-[var(--color-danger-500)]">
                    {previewJob.errorMessage ??
                      "The preview could not be created."}
                  </p>
                ) : null}
              </form>
            </div>
          )}

          <form action={withdrawStylePortraitConsent}>
            <input type="hidden" name="retailerId" value={retailerId} />
            <button
              type="submit"
              className={`${buttonVariants({ variant: "outline", size: "sm" })} self-start`}
            >
              Revoke consent
            </button>
          </form>
        </div>
      )}
    </Card>
  );
}
