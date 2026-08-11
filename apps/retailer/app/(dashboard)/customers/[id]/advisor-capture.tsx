"use client";

import type { AdvisorCaptureBundle } from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  captureNote,
  confirmCaptureBundle,
  dismissCaptureBundle,
  type BundleActionState,
  type CaptureActionState,
} from "./actions";

const captureInitial: CaptureActionState = {};
const bundleInitial: BundleActionState = {};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const KIND_LABELS: Record<AdvisorCaptureBundle["kind"], string> = {
  self_portrait_fact: "Self-Portrait",
  follow_up: "Follow-up",
  task_note: "Note",
};

function summarizePayload(bundle: AdvisorCaptureBundle): string {
  if (bundle.kind === "self_portrait_fact") {
    const payload = bundle.payload as { factType: string; valueLabel: string };
    return `${payload.factType.replaceAll("_", " ")}: ${payload.valueLabel}`;
  }
  if (bundle.kind === "follow_up") {
    const payload = bundle.payload as {
      whyNow: string;
      suggestedAction: string;
      dueAt?: string;
    };
    return `${payload.suggestedAction}${payload.dueAt ? ` — due ${payload.dueAt}` : ""}`;
  }
  const payload = bundle.payload as { note: string };
  return payload.note;
}

function BundleCard({
  bundle,
  customerId,
}: {
  readonly bundle: AdvisorCaptureBundle;
  readonly customerId: string;
}) {
  const router = useRouter();
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmCaptureBundle.bind(null, customerId),
    bundleInitial,
  );
  const [dismissState, dismissAction, dismissPending] = useActionState(
    dismissCaptureBundle.bind(null, customerId),
    bundleInitial,
  );

  // revalidatePath alone does not reliably repaint this list client-side
  // (same class of issue `advisor-rectangle-capture.tsx` already works
  // around) — explicitly refresh once a submission settles without error,
  // so a confirmed/dismissed bundle actually leaves "needs your review"
  // instead of sitting there until an unrelated navigation catches up.
  const wasPending = useRef(false);
  useEffect(() => {
    const isPending = confirmPending || dismissPending;
    if (
      wasPending.current &&
      !isPending &&
      !confirmState.formError &&
      !dismissState.formError
    ) {
      router.refresh();
    }
    wasPending.current = isPending;
  }, [confirmPending, dismissPending, confirmState, dismissState, router]);

  return (
    <li
      data-bundle-id={bundle.id}
      data-bundle-kind={bundle.kind}
      className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <Badge tone="neutral">{KIND_LABELS[bundle.kind]}</Badge>
        <span className="text-xs text-[var(--color-stone-500)]">
          {Math.round(bundle.confidence * 100)}% confidence
        </span>
      </div>
      <p className="text-sm font-medium text-[var(--color-stone-900)]">
        {bundle.summary}
      </p>
      <p className="text-xs text-[var(--color-stone-600)]">
        {summarizePayload(bundle)}
      </p>
      <p className="text-xs italic text-[var(--color-stone-500)]">
        &ldquo;{bundle.sourceExcerpt}&rdquo;
      </p>
      <div className="flex items-center gap-2">
        <form action={confirmAction}>
          <input type="hidden" name="bundleId" value={bundle.id} />
          <Button type="submit" size="sm" disabled={confirmPending}>
            Confirm
          </Button>
        </form>
        <form action={dismissAction}>
          <input type="hidden" name="bundleId" value={bundle.id} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={dismissPending}
          >
            Dismiss
          </Button>
        </form>
      </div>
      {confirmState.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {confirmState.formError}
        </p>
      ) : null}
      {dismissState.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {dismissState.formError}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Frictionless note capture: an AI pass proposes bundles against the
 * Self-Portrait and follow-ups, but nothing writes anywhere until an
 * advisor confirms or dismisses each one below — see the exact source
 * excerpt every suggestion is quoted from before deciding.
 */
export function AdvisorCapture({
  customerId,
  aiConfigured,
  pendingBundles,
}: {
  readonly customerId: string;
  readonly aiConfigured: boolean;
  readonly pendingBundles: readonly AdvisorCaptureBundle[];
}) {
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function toggleVoiceCapture() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechError("Voice capture is not available in this browser.");
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (!transcript || !textareaRef.current) return;
      textareaRef.current.value = `${textareaRef.current.value.trim()}${textareaRef.current.value.trim() ? " " : ""}${transcript}`;
      textareaRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setSpeechError(
        "Voice capture stopped. Check microphone permission and try again.",
      );
    };
    recognitionRef.current = recognition;
    setSpeechError(null);
    setListening(true);
    recognition.start();
  }

  const [state, action, pending] = useActionState(
    captureNote.bind(null, customerId),
    captureInitial,
  );

  return (
    <Card>
      <h2 className="mb-3 text-lg font-medium">Capture a note</h2>
      {!aiConfigured ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          AI capture is not configured on this deployment.
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <textarea
            ref={textareaRef}
            name="rawText"
            required
            maxLength={8000}
            className="min-h-24 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 text-sm"
            placeholder="Type what came up — preferences, a promise, anything worth keeping. The system proposes what to do with it; nothing is saved until you confirm."
          />
          <label className="flex max-w-xs flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
              Capture source
            </span>
            <select
              name="source"
              defaultValue="text"
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-2"
            >
              <option value="text">Typed note</option>
              <option value="voice">Voice memo transcript</option>
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={toggleVoiceCapture}
          >
            {listening ? "Stop voice memo" : "Add voice memo"}
          </Button>
          {speechError ? (
            <p role="alert" className="text-sm text-[var(--color-danger-500)]">
              {speechError}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Extracting…" : "Extract"}
          </Button>
          {state.formError ? (
            <p role="alert" className="text-sm text-[var(--color-danger-500)]">
              {state.formError}
            </p>
          ) : state.sessionId ? (
            <p role="status" className="text-sm text-[var(--color-stone-500)]">
              {state.bundleCount
                ? `${state.bundleCount} suggestion${state.bundleCount === 1 ? "" : "s"} below.`
                : "Nothing actionable found in that note."}
            </p>
          ) : null}
        </form>
      )}

      {pendingBundles.length > 0 ? (
        <div className="mt-4 border-t border-[var(--color-stone-200)] pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
            Needs your review ({pendingBundles.length})
          </p>
          <ul data-capture-review className="flex flex-col gap-3">
            {pendingBundles.map((bundle) => (
              <BundleCard
                key={bundle.id}
                bundle={bundle}
                customerId={customerId}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
