"use client";

import type {
  FitArchetypeOption,
  FitArchetypeSlug,
  StylePortrait,
  StylePortraitConsent,
  StylePortraitReference,
  StylePortraitReferenceKind,
  WardrobeVisualizationJob,
} from "@paon/domain";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";

import { NEXT_ACTION_ID, useActionRunner } from "./fitting-room-shared";
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

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const initialUploadState: UploadReferenceState = {};

interface PhotoSlotSpec {
  readonly kind: Extract<
    StylePortraitReferenceKind,
    "face" | "full_body" | "side"
  >;
  readonly title: string;
  readonly required: boolean;
  readonly hint: string;
}

const PHOTO_SLOTS: readonly PhotoSlotSpec[] = [
  {
    kind: "face",
    title: "Face",
    required: true,
    hint: "Front-facing, even light, no sunglasses or hat.",
  },
  {
    kind: "full_body",
    title: "Full body",
    required: true,
    hint: "Head to toe, standing straight, fitted clothes.",
  },
  {
    kind: "side",
    title: "Side",
    required: false,
    hint: "A side-on or relaxed three-quarter pose, head to toe.",
  },
];

export type PortraitStepId =
  "consent" | "photos" | "fit" | "generate" | "working" | "approve" | "ready";

export interface PortraitStep {
  readonly id: PortraitStepId;
  /** The one primary action's label. */
  readonly label: string;
  readonly status: string;
  readonly pill: string;
  readonly usable: StylePortrait | null;
  readonly consentGranted: boolean;
  readonly locked: boolean;
}

/** Where the customer is in setting up their portrait; drives the rail's one
 * primary button and the stage's pointer at it. */
export function derivePortraitStep(
  consent: StylePortraitConsent,
  portrait: StylePortrait | null,
  previewJob: WardrobeVisualizationJob | null,
): PortraitStep {
  const consentGranted =
    consent.status === "granted" && consent.disclosuresAcknowledged;
  const usable =
    portrait &&
    portrait.status !== "rejected" &&
    portrait.status !== "superseded"
      ? portrait
      : null;
  const has = (kind: StylePortraitReferenceKind) =>
    Boolean(usable?.references.some((ref) => ref.kind === kind));
  const hasFace = has("face");
  const hasBody = has("full_body");
  const hasFit = Boolean(usable?.fitArchetypeConceptId);
  const status = usable?.status;
  const previewActive =
    previewJob?.status === "queued" || previewJob?.status === "generating";

  const base = { usable, consentGranted };
  if (!consentGranted) {
    return {
      ...base,
      id: "consent",
      label: "Agree & continue",
      status: "Agree below to start.",
      pill: "Needs consent",
      locked: true,
    };
  }
  if (status === "approved") {
    return {
      ...base,
      id: "ready",
      label: "Portrait ready",
      status: "Approved. Add pieces and try them on.",
      pill: "Approved",
      locked: true,
    };
  }
  if (status === "preview_generated") {
    return {
      ...base,
      id: "approve",
      label: "Approve portrait",
      status: "Check the preview looks like you, then approve.",
      pill: "Preview ready",
      locked: true,
    };
  }
  if (previewActive) {
    return {
      ...base,
      id: "working",
      label: "Creating portrait…",
      status:
        previewJob?.status === "queued"
          ? "Your neutral portrait is queued."
          : "Creating your neutral portrait…",
      pill: "Creating",
      locked: true,
    };
  }
  if (!hasFace || !hasBody) {
    const missing =
      !hasFace && !hasBody
        ? "face and full-body photos"
        : !hasFace
          ? "face photo"
          : "full-body photo";
    return {
      ...base,
      id: "photos",
      label: "Add photos",
      status: `Add your ${missing}.`,
      pill: "Setting up",
      locked: false,
    };
  }
  if (!hasFit) {
    return {
      ...base,
      id: "fit",
      label: "Choose fit",
      status: "Choose the fit you prefer.",
      pill: "Setting up",
      locked: false,
    };
  }
  return {
    ...base,
    id: "generate",
    label:
      previewJob?.status === "failed"
        ? "Try again"
        : "Generate neutral preview",
    status:
      previewJob?.status === "failed"
        ? (previewJob.errorMessage ?? "The portrait could not be created.")
        : "Ready to create your neutral portrait.",
    pill: "Setting up",
    locked: false,
  };
}

function latestReference(
  portrait: StylePortrait | null,
  kind: StylePortraitReferenceKind,
): { latest: StylePortraitReference | undefined; count: number } {
  const matches = (portrait?.references ?? []).filter(
    (reference) => reference.kind === kind,
  );
  const latest = [...matches].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  )[0];
  return { latest, count: matches.length };
}

function PhotoSlot({
  retailerId,
  spec,
  portrait,
  previews,
  locked,
}: {
  retailerId: string;
  spec: PhotoSlotSpec;
  portrait: StylePortrait | null;
  previews: Readonly<Record<string, string>>;
  locked: boolean;
}) {
  const bound = uploadStylePortraitReference.bind(null, retailerId, spec.kind);
  const [state, formAction, isUploading] = useActionState(
    bound,
    initialUploadState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const { latest, count } = latestReference(portrait, spec.kind);
  const serverUrl = latest ? previews[latest.id] : undefined;
  const shownUrl = localUrl ?? serverUrl;

  // Drop the local preview once the server copy (or an error) has arrived.
  useEffect(() => {
    if (isUploading) return;
    setLocalUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, [isUploading, latest?.id, state]);

  function submitFile(file: File | undefined) {
    setLocalError(null);
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setLocalError("Use a JPEG, PNG or WebP photo.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("Photo must be 10 MB or smaller.");
      return;
    }
    setLocalUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    formRef.current?.requestSubmit();
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    if (locked || isUploading) return;
    const file = event.dataTransfer.files[0];
    if (!file || !inputRef.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    inputRef.current.files = transfer.files;
    submitFile(file);
  }

  const inputId = `paon-fitting-photo-${spec.kind}`;
  const error = localError ?? state.formError ?? null;
  const caption = shownUrl
    ? locked
      ? "Saved"
      : "Replace"
    : spec.required
      ? "Required"
      : "Optional";
  const label = [
    spec.title,
    shownUrl ? "photo added" : "photo needed",
    count > 1 ? `${count} added, newest used` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="paon-fit-slot">
      <form ref={formRef} action={formAction}>
        <label
          htmlFor={inputId}
          className="paon-fit-drop"
          title={
            count > 1 ? `${count} photos added, the newest is used` : spec.hint
          }
          data-filled={shownUrl ? "true" : "false"}
          data-over={dragOver ? "true" : "false"}
          data-busy={isUploading ? "true" : "false"}
          data-locked={locked ? "true" : "false"}
          onDragOver={(event) => {
            event.preventDefault();
            if (!locked) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            id={inputId}
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={locked || isUploading}
            aria-label={label}
            onChange={(event) => submitFile(event.target.files?.[0])}
          />
          {shownUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownUrl}
              alt={`Your ${spec.title.toLowerCase()} reference`}
            />
          ) : (
            <span className="paon-fit-plus" aria-hidden="true">
              +
            </span>
          )}
          {isUploading ? (
            <span className="paon-fit-drop-busy" role="status">
              Uploading…
            </span>
          ) : null}
        </label>
      </form>
      <span className="paon-fit-slot-name">{spec.title}</span>
      <span className="paon-fit-slot-sub">{caption}</span>
      {error ? (
        <p role="alert" className="paon-fit-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const SILHOUETTE: Record<FitArchetypeSlug, readonly [number, number, number]> =
  {
    slim: [12, 8, 10],
    classic: [15, 12, 14],
    contemporary: [15, 10, 15],
    fashion_wide: [18, 16, 19],
  };

function Silhouette({ slug }: { slug: FitArchetypeSlug }) {
  const [s, w, h] = SILHOUETTE[slug];
  const c = 22;
  return (
    <svg viewBox="0 0 44 56" aria-hidden="true">
      <path
        d={`M${c - s} 12 Q${c} 3 ${c + s} 12 L${c + w} 32 L${c + h} 52 L${c - h} 52 L${c - w} 32 Z`}
      />
    </svg>
  );
}

function FitChips({
  retailerId,
  archetypes,
  selectedId,
  disabled,
}: {
  retailerId: string;
  archetypes: readonly FitArchetypeOption[];
  selectedId: string | undefined;
  disabled: boolean;
}) {
  const { pending, error, run } = useActionRunner();
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const active = optimistic ?? selectedId;

  useEffect(() => {
    if (!pending) setOptimistic(null);
  }, [pending, selectedId]);

  return (
    <div>
      <p className="paon-fit-label">Fit</p>
      <div className="paon-fit-chips" role="group" aria-label="Fit preference">
        {archetypes.map((archetype) => (
          <button
            key={archetype.conceptId}
            type="button"
            data-fit-chip
            className="paon-fit-chip"
            title={archetype.description}
            aria-pressed={active === archetype.conceptId}
            disabled={disabled || pending}
            onClick={() => {
              setOptimistic(archetype.conceptId);
              run(() => declareFitArchetype(retailerId, archetype.conceptId));
            }}
          >
            <Silhouette slug={archetype.slug} />
            {archetype.label}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="paon-fit-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Consent({
  retailerName,
  understood,
  onChange,
}: {
  retailerName: string;
  understood: boolean;
  onChange: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="paon-fit-consent">
      <label className="paon-fit-check">
        <input
          type="checkbox"
          checked={understood}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          I agree to {retailerName} using my photos to create AI try-on images.
          Private to you and your advisor, visualisation only, never a fit
          guarantee.
        </span>
      </label>
      <button
        type="button"
        className="paon-fit-link"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Details {open ? "▴" : "▾"}
      </button>
      {open ? (
        <ul className="paon-fit-disclosure">
          <li>
            To show you wearing pieces, {retailerName} needs three photos of
            you: face, full body and a side pose.
          </li>
          <li>
            Your advisor at {retailerName} can see your photos and every look
            generated from them.
          </li>
          <li>
            Every result is created by AI. It is a visualisation only, never a
            promise of how a garment will physically fit.
          </li>
          <li>
            Your photos are private to you and {retailerName}. You can delete
            them, or withdraw this permission, at any time.
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/** The "You" rail: portrait status, three photo slots, fit, and the one
 * primary next action. */
export function FittingPortraitCard({
  retailerId,
  retailerName,
  consent,
  portrait,
  previewJob,
  fitArchetypes,
  referencePreviews,
}: {
  retailerId: string;
  retailerName: string;
  consent: StylePortraitConsent;
  portrait: StylePortrait | null;
  previewJob: WardrobeVisualizationJob | null;
  fitArchetypes: readonly FitArchetypeOption[];
  referencePreviews: Readonly<Record<string, string>>;
}) {
  const step = derivePortraitStep(consent, portrait, previewJob);
  const { usable, consentGranted } = step;
  const runner = useActionRunner();
  const revoke = useActionRunner();
  const [understood, setUnderstood] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  function formWith(): FormData {
    const data = new FormData();
    data.set("retailerId", retailerId);
    return data;
  }

  function onPrimary() {
    switch (step.id) {
      case "consent":
        runner.run(() => grantStylePortraitConsent(formWith()));
        break;
      case "photos": {
        const missing = PHOTO_SLOTS.find(
          (spec) =>
            spec.required &&
            !usable?.references.some((ref) => ref.kind === spec.kind),
        );
        document
          .getElementById(`paon-fitting-photo-${missing?.kind ?? "face"}`)
          ?.click();
        break;
      }
      case "fit": {
        const chip = document.querySelector<HTMLElement>("[data-fit-chip]");
        chip?.scrollIntoView({ block: "nearest" });
        chip?.focus();
        break;
      }
      case "generate":
        runner.run(() => generateStylePortraitPreview(formWith()));
        break;
      case "approve":
        runner.run(() => approveStylePortrait(formWith()));
        break;
      default:
        break;
    }
  }

  const primaryDisabled =
    runner.pending ||
    step.id === "working" ||
    step.id === "ready" ||
    (step.id === "consent" && !understood);
  const anyPhoto = PHOTO_SLOTS.some((spec) =>
    usable?.references.some((ref) => ref.kind === spec.kind),
  );

  return (
    <section
      id="fitting-room-portrait"
      className="paon-fit-zone paon-fit-you"
      aria-labelledby="fitting-room-you-title"
    >
      <div className="paon-fit-zone-head">
        <h3 id="fitting-room-you-title" className="paon-fit-label">
          You
        </h3>
        <span className="paon-fit-pill" data-step={step.id}>
          {step.pill}
        </span>
      </div>

      {!consentGranted ? (
        <Consent
          retailerName={retailerName}
          understood={understood}
          onChange={setUnderstood}
        />
      ) : null}

      <div className="paon-fit-slots">
        {PHOTO_SLOTS.map((spec) => (
          <PhotoSlot
            key={spec.kind}
            retailerId={retailerId}
            spec={spec}
            portrait={usable}
            previews={referencePreviews}
            locked={step.locked}
          />
        ))}
      </div>
      {consentGranted && !step.locked && anyPhoto ? (
        <p className="paon-fit-note">
          Replace adds a new photo; the newest is used.
        </p>
      ) : null}

      {fitArchetypes.length > 0 ? (
        <FitChips
          retailerId={retailerId}
          archetypes={fitArchetypes}
          selectedId={usable?.fitArchetypeConceptId}
          disabled={!usable || step.locked}
        />
      ) : null}

      <div className="paon-fit-next">
        <p
          className="paon-fit-status"
          role="status"
          data-failed={
            previewJob?.status === "failed" && step.id === "generate"
          }
        >
          {step.status}
        </p>
        <button
          id={NEXT_ACTION_ID}
          type="button"
          className="paon-fit-btn paon-fit-btn-block"
          data-step={step.id}
          disabled={primaryDisabled}
          onClick={onPrimary}
        >
          {runner.pending && step.id !== "photos" && step.id !== "fit"
            ? "Working…"
            : step.label}
        </button>
        {runner.error ? (
          <p role="alert" className="paon-fit-error">
            {runner.error}
          </p>
        ) : null}
      </div>

      {consentGranted ? (
        <div className="paon-fit-links">
          {step.id === "approve" ? (
            <button
              type="button"
              className="paon-fit-link"
              disabled={runner.pending}
              onClick={() => runner.run(() => restartStylePortrait(formWith()))}
            >
              Start over
            </button>
          ) : null}
          {step.id === "ready" ? (
            <button
              type="button"
              className="paon-fit-link"
              disabled={runner.pending}
              onClick={() => runner.run(() => restartStylePortrait(formWith()))}
            >
              Use different photos
            </button>
          ) : null}
          {confirmRevoke ? (
            <span className="paon-fit-confirm">
              Withdraw permission? Try-on stops until you agree again.
              <button
                type="button"
                className="paon-fit-link"
                disabled={revoke.pending}
                onClick={() =>
                  revoke.run(async () => {
                    await withdrawStylePortraitConsent(formWith());
                    setConfirmRevoke(false);
                  })
                }
              >
                Yes, withdraw
              </button>
              <button
                type="button"
                className="paon-fit-link"
                onClick={() => setConfirmRevoke(false)}
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="paon-fit-link"
              onClick={() => setConfirmRevoke(true)}
            >
              Withdraw photo permission
            </button>
          )}
          {revoke.error ? (
            <p role="alert" className="paon-fit-error">
              {revoke.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
