"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * Direct port of the founder's `vox-` Adobe Muse widget (chip-slider
 * momentum physics + Dutch voice command parsing) into a React client
 * component. Drag state (position, velocity samples, active pointer) is
 * kept in refs and applied via direct DOM writes on the track/chip
 * elements, not component state — matching the original's own imperative
 * approach, and avoiding a per-frame re-render during drag, which is
 * what a fully declarative port would force. `applyValue` calls
 * `onApply(fieldName, formattedValue)` so the parent page persists it as
 * a FittingObservation, instead of only updating the chip's own display.
 *
 * Not ported from the original: the "both shoulders at once" voice combo,
 * the continued-listening grace-period re-refinement window, and the
 * wheel/trackpad handler — real interactions, deliberately deferred
 * rather than risking a subtly wrong port of the trickiest parts of the
 * original parser and input handling. Tap-to-select, drag-to-scrub (with
 * release-velocity momentum and edge rubber-banding), and voice all work
 * for every field; voice applies a value the moment a field + number are
 * both recognized in one utterance.
 */

interface FieldConfig {
  name: string;
  left: string;
  right: string;
  limit: number;
  step: number;
  matchFn: (t: string) => boolean;
  dirLabel: { pos: string; neg: string };
}

function generateVals(limit: number, step: number): number[] {
  const vals: number[] = [];
  for (let v = -limit; v <= limit; v += step)
    vals.push(parseFloat(v.toFixed(1)));
  return vals;
}

const FIELDS: FieldConfig[] = [
  {
    name: "Neiging",
    left: "Achterwaarts",
    right: "Voorwaarts",
    limit: 3,
    step: 0.5,
    matchFn: (t) => /neiging|nee\s?ging/i.test(t),
    dirLabel: { pos: "Voorwaarts", neg: "Achterwaarts" },
  },
  {
    name: "Kraag",
    left: "Kraagplooi",
    right: "Hoger",
    limit: 4,
    step: 0.5,
    matchFn: (t) => /kraag|krach|krag\b|krijg/i.test(t),
    dirLabel: { pos: "Hoger", neg: "Kraagplooi" },
  },
  {
    name: "Schouder R",
    left: "Lager",
    right: "Hoger",
    limit: 2,
    step: 0.5,
    matchFn: (t) => /schouder\s*(r|re|rechts)|rechts$/i.test(t),
    dirLabel: { pos: "Hoger", neg: "Lager" },
  },
  {
    name: "Schouder L",
    left: "Lager",
    right: "Hoger",
    limit: 2,
    step: 0.5,
    matchFn: (t) => /schouder\s*(l|li|links)|links$/i.test(t),
    dirLabel: { pos: "Hoger", neg: "Lager" },
  },
  {
    name: "Sluitknoop",
    left: "Lager",
    right: "Hoger",
    limit: 2,
    step: 0.5,
    matchFn: (t) => /sluitknoop|slijt|knoop|knop/i.test(t),
    dirLabel: { pos: "Hoger", neg: "Lager" },
  },
  {
    name: "Armsgat",
    left: "Lager",
    right: "Hoger",
    limit: 2,
    step: 0.5,
    matchFn: (t) => /armsgat|armschat/i.test(t),
    dirLabel: { pos: "Hoger", neg: "Lager" },
  },
  {
    name: "Mouwpositie",
    left: "Voorwaarts",
    right: "Achterwaarts",
    limit: 1,
    step: 0.5,
    matchFn: (t) => /mouwpositie|mouw/i.test(t),
    dirLabel: { pos: "Achterwaarts", neg: "Voorwaarts" },
  },
];

function fmt(v: number): string {
  return v === 0 ? "0" : (v > 0 ? "+" : "") + v.toFixed(1);
}

function parseValue(raw: string): number | null {
  let s = raw
    .replace(
      /\b(lager|hoger|voorwaarts|achterwaarts|kraagplooi|omhoog|omlaag|plus|erbij|wijder|groter|kleiner|innemen|vernauwen|minder|meer|uitleggen|vergroten|eraf)\b/gi,
      "",
    )
    .replace(/\bnul\b/gi, "0")
    .replace(/\b(één|een)\b/gi, "1")
    .replace(/\btwee\b/gi, "2")
    .replace(/\bdrie\b/gi, "3")
    .replace(/\bvier\b/gi, "4")
    .replace(
      /(\d+)\s*(komma|punt)\s*(\d+)/gi,
      (_m, a: string, _sep, b: string) => `${a}.${b}`,
    )
    .replace(/\bhalf\b|\bhalve\b/gi, "0.5");
  s = s.replace(
    /\b(min|minus)\s+(\d+(\.\d+)?)/gi,
    (_m, _sign, num: string) => `-${num}`,
  );
  s = s.replace(/(\d+),(\d+)/g, "$1.$2");
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function parseDirection(t: string, field: FieldConfig): number {
  const pos = field.dirLabel.pos.toLowerCase();
  const neg = field.dirLabel.neg.toLowerCase();
  if (new RegExp(`\\b${neg}\\b`, "i").test(t)) return -1;
  if (new RegExp(`\\b${pos}\\b`, "i").test(t)) return 1;
  if (/\b(min|minus|eraf|kleiner|innemen|vernauwen|minder|omlaag)\b/i.test(t))
    return -1;
  if (/\b(plus|erbij|wijder|groter|uitleggen|vergroten|meer|omhoog)\b/i.test(t))
    return 1;
  return 0;
}

export function VoiceMeasurementSlider({
  onApply,
}: {
  onApply: (fieldName: string, formattedValue: string) => void | Promise<void>;
}) {
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  const swRefs = useRef<(HTMLDivElement | null)[]>([]);
  const curXRef = useRef<number[]>([]);
  const dragRef = useRef<{
    index: number;
    startX: number;
    startPX: number;
    samples: { t: number; x: number }[];
    moved: boolean;
  } | null>(null);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  const CHIP_W = 46;
  const GAP = 6;
  const STEP = CHIP_W + GAP;

  function getCenter(index: number): number {
    const width = trackRefs.current[index]?.parentElement?.clientWidth ?? 0;
    return width / 2 - CHIP_W / 2;
  }

  function getBounds(index: number, vals: number[]) {
    const center = getCenter(index);
    return { min: center - (vals.length - 1) * STEP, max: center };
  }

  function getNearestIndexFromX(index: number, x: number, vals: number[]) {
    const center = getCenter(index);
    return Math.max(
      0,
      Math.min(vals.length - 1, Math.round((center - x) / STEP)),
    );
  }

  /** Live visual feedback during drag — mirrors the original's per-chip
   * green/red/transparent tint while dragging, cleared once settled. */
  function paintTrack(index: number, x: number, dragging: boolean) {
    const track = trackRefs.current[index];
    const sw = swRefs.current[index];
    const field = FIELDS[index];
    if (!track || !field) return;
    const vals = generateVals(field.limit, field.step);
    track.style.transform = `translateX(${x}px)`;
    const nearest = getNearestIndexFromX(index, x, vals);
    const value = vals[nearest];
    if (sw && value !== undefined) sw.textContent = fmt(value);

    for (let i = 0; i < track.children.length; i++) {
      const chip = track.children[i];
      if (!(chip instanceof HTMLElement)) continue;
      const v = vals[i];
      if (v === undefined) continue;
      if (dragging) {
        const isZero = Math.abs(v) < 0.001;
        chip.style.background = isZero
          ? "transparent"
          : v > 0
            ? "#BCD4C6"
            : "#FFE6E6";
        chip.style.color = isZero ? "#808080" : v > 0 ? "#009144" : "#ED1C27";
      } else {
        chip.style.background = "";
        chip.style.color = "";
      }
    }
  }

  function applyValue(index: number, value: number) {
    const field = FIELDS[index];
    if (!field) return;
    onApplyRef.current(field.name, fmt(value));
    setActiveIndex(index);
    window.setTimeout(() => setActiveIndex(null), 900);
  }

  function snapTrackToValue(index: number, value: number) {
    const track = trackRefs.current[index];
    const field = FIELDS[index];
    if (!track || !field) return;
    const vals = generateVals(field.limit, field.step);
    const i = vals.findIndex((v) => Math.abs(v - value) < 0.001);
    if (i === -1) return;
    const x = getCenter(index) - i * STEP;
    curXRef.current[index] = x;
    track.style.transition = "transform 400ms cubic-bezier(0.23,1,0.32,1)";
    paintTrack(index, x, false);
  }

  /** Pointer-drag-to-scrub with release-velocity momentum and edge
   * rubber-banding, matching the mockup's own physics. Position is
   * written straight to the DOM via refs during the drag (no re-render
   * per frame); the field's value is only actually applied once, on
   * release, at the velocity-projected snap index.
   *
   * This viewport-level handling and each chip's own `onClick` are both
   * bound (matching the mockup's own dual row+chip binding), so a plain
   * tap on a chip also dispatches a pointerdown/pointerup pair here with
   * ~0 movement. Two things keep a tap from fighting its own chip click:
   * `setPointerCapture` is deferred until real movement is confirmed —
   * capturing immediately on every pointerdown was observed to suppress
   * the chip's native click from ever firing at all (Chromium routes the
   * click through pointer capture too, not just move/up, despite capture
   * nominally only affecting pointer events) — and the snap+apply logic
   * itself only runs once movement crossed `MOVE_THRESHOLD`, so a
   * stationary tap's outcome is solely owned by the chip's own onClick. */
  const MOVE_THRESHOLD = 4;

  function onTrackPointerDown(
    index: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const track = trackRefs.current[index];
    const field = FIELDS[index];
    if (!track || !field) return;
    const vals = generateVals(field.limit, field.step);
    const startX =
      curXRef.current[index] ?? getCenter(index) - vals.indexOf(0) * STEP;
    dragRef.current = {
      index,
      startX,
      startPX: event.clientX,
      samples: [{ t: performance.now(), x: event.clientX }],
      moved: false,
    };
  }

  function onTrackPointerMove(
    index: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const drag = dragRef.current;
    if (!drag || drag.index !== index) return;
    if (
      !drag.moved &&
      Math.abs(event.clientX - drag.startPX) < MOVE_THRESHOLD
    ) {
      return;
    }
    if (!drag.moved) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      const track = trackRefs.current[index];
      if (track) track.style.transition = "";
    }
    const field = FIELDS[index];
    if (!field) return;
    const vals = generateVals(field.limit, field.step);
    const bounds = getBounds(index, vals);
    let x = drag.startX + (event.clientX - drag.startPX);
    if (x < bounds.min) x = bounds.min - (bounds.min - x) * 0.25;
    else if (x > bounds.max) x = bounds.max + (x - bounds.max) * 0.25;

    curXRef.current[index] = x;
    drag.samples.push({ t: performance.now(), x: event.clientX });
    if (drag.samples.length > 6) drag.samples.shift();
    paintTrack(index, x, true);
  }

  function onTrackPointerUp(
    index: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const drag = dragRef.current;
    if (!drag || drag.index !== index) return;
    dragRef.current = null;
    if (!drag.moved) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const field = FIELDS[index];
    const track = trackRefs.current[index];
    if (!field || !track) return;
    const vals = generateVals(field.limit, field.step);
    const bounds = getBounds(index, vals);
    const x = Math.max(
      bounds.min,
      Math.min(bounds.max, curXRef.current[index] ?? bounds.max),
    );

    let velocity = 0;
    const samples = drag.samples;
    const last = samples[samples.length - 1];
    if (samples.length >= 2 && last) {
      const ref = samples.find((s) => last.t - s.t <= 80) ?? samples[0];
      const dt = ref ? last.t - ref.t : 0;
      if (ref && dt > 0) velocity = (last.x - ref.x) / dt;
    }

    const DECEL_DIST = 28;
    const projected = Math.max(
      bounds.min,
      Math.min(bounds.max, x + velocity * DECEL_DIST),
    );
    const snapIdx = getNearestIndexFromX(index, projected, vals);
    const targetX = getCenter(index) - snapIdx * STEP;

    curXRef.current[index] = targetX;
    track.style.transition = "transform 400ms cubic-bezier(0.23,1,0.32,1)";
    paintTrack(index, targetX, false);

    const value = vals[snapIdx];
    if (value !== undefined) applyValue(index, value);
  }

  useEffect(() => {
    function positionAll() {
      FIELDS.forEach((field, index) => {
        if (dragRef.current?.index === index) return;
        const vals = generateVals(field.limit, field.step);
        const track = trackRefs.current[index];
        if (!track) return;
        const existing = curXRef.current[index];
        const nearest =
          existing === undefined
            ? vals.indexOf(0)
            : getNearestIndexFromX(index, existing, vals);
        const x = getCenter(index) - nearest * STEP;
        curXRef.current[index] = x;
        track.style.transition = "";
        track.style.transform = `translateX(${x}px)`;
      });
    }
    positionAll();
    window.addEventListener("resize", positionAll);
    return () => window.removeEventListener("resize", positionAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const rec = new SpeechRecognitionCtor();
    rec.lang = "nl-NL";
    rec.interimResults = true;
    rec.continuous = true;
    let locked = false;

    rec.onresult = (event) => {
      if (locked) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i]?.[0]?.transcript?.toLowerCase().trim();
        if (!chunk) continue;
        const fieldIndex = FIELDS.findIndex((f) => f.matchFn(chunk));
        if (fieldIndex === -1) continue;
        const field = FIELDS[fieldIndex];
        if (!field) continue;
        const num = parseValue(chunk);
        if (num === null) {
          setTranscript(`${field.name} …`);
          continue;
        }
        let dir = parseDirection(chunk, field);
        if (dir === 0) dir = num >= 0 ? 1 : -1;
        const finalVal = dir === -1 ? -Math.abs(num) : Math.abs(num);
        setTranscript(`${field.name} ${fmt(finalVal)}`);
        snapTrackToValue(fieldIndex, finalVal);
        applyValue(fieldIndex, finalVal);
        locked = true;
        rec.stop();
        window.setTimeout(() => {
          locked = false;
          setTranscript("");
        }, 1200);
      }
    };
    rec.onend = () => {
      if (recRef.current === rec && listening && !locked) rec.start();
    };
    rec.onerror = (event) => {
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        setListening(false);
        setTranscript("Microfoon geweigerd");
      }
    };
    recRef.current = rec;
    return () => {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleListening() {
    const rec = recRef.current;
    if (!rec) {
      setTranscript("Niet ondersteund");
      return;
    }
    const next = !listening;
    setListening(next);
    if (next) {
      setTranscript("");
      rec.start();
    } else {
      rec.stop();
      setTranscript("");
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-[350px] grid-cols-1 gap-2.5 lg:max-w-3xl lg:grid-cols-2 lg:gap-x-8 lg:gap-y-3">
      {FIELDS.map((field, index) => {
        const vals = generateVals(field.limit, field.step);
        return (
          <div key={field.name} data-field={field.name} className="w-full">
            <div
              className={`overflow-hidden rounded-lg px-2 py-1 transition-colors duration-500 ${
                activeIndex === index
                  ? "bg-[linear-gradient(90deg,#333_0%,#000_100%)]"
                  : "bg-[var(--color-stone-100)]"
              }`}
            >
              <div className="mb-px flex items-center justify-between">
                <span
                  className={`flex-1 whitespace-nowrap text-[10px] ${activeIndex === index ? "text-white/50" : "text-[var(--color-stone-400)]"}`}
                >
                  {field.left}
                </span>
                <span
                  className={`flex-[2] whitespace-nowrap px-1 text-center text-[10px] ${activeIndex === index ? "text-white" : "text-[var(--color-stone-700)]"}`}
                >
                  {field.name}
                </span>
                <span
                  className={`flex-1 whitespace-nowrap text-right text-[10px] ${activeIndex === index ? "text-white/50" : "text-[var(--color-stone-400)]"}`}
                >
                  {field.right}
                </span>
              </div>
              <div className="relative flex h-11 items-center justify-center">
                <div
                  ref={(el) => {
                    swRefs.current[index] = el;
                  }}
                  aria-hidden="true"
                  className="pointer-events-none absolute z-10 flex h-10 w-[46px] items-center justify-center rounded-[10px] bg-white text-[10px] font-semibold text-[var(--color-stone-500)]"
                >
                  0
                </div>
                <div
                  onPointerDown={(event) => onTrackPointerDown(index, event)}
                  onPointerMove={(event) => onTrackPointerMove(index, event)}
                  onPointerUp={(event) => onTrackPointerUp(index, event)}
                  onPointerCancel={(event) => onTrackPointerUp(index, event)}
                  className="relative h-full w-full touch-pan-y select-none overflow-hidden"
                  style={{
                    WebkitMaskImage:
                      "linear-gradient(to right, transparent, black 30%, black 70%, transparent)",
                    maskImage:
                      "linear-gradient(to right, transparent, black 30%, black 70%, transparent)",
                  }}
                >
                  <div
                    ref={(el) => {
                      trackRefs.current[index] = el;
                    }}
                    className="absolute flex h-full items-center gap-1.5"
                  >
                    {vals.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          snapTrackToValue(index, v);
                          applyValue(index, v);
                        }}
                        className="flex h-10 w-[46px] shrink-0 items-center justify-center rounded-[10px] bg-white text-[10px] font-semibold text-[var(--color-stone-400)] active:scale-90 motion-reduce:active:scale-100"
                      >
                        {fmt(v)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="mt-3 flex flex-col items-center gap-2 lg:col-span-2">
        {transcript ? (
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-[var(--color-stone-700)]"
          >
            {transcript}
          </p>
        ) : null}
        <button
          type="button"
          onClick={toggleListening}
          aria-pressed={listening}
          aria-label={listening ? "Stop voice input" : "Start voice input"}
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.2)] transition-colors ${
            listening
              ? "animate-pulse bg-[linear-gradient(90deg,#ED1C27_0%,#C4101F_100%)]"
              : "bg-[linear-gradient(90deg,#808080_0%,#000_100%)]"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white/90">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20H9v2h6v-2h-2v-2.08A7 7 0 0 0 19 11h-2z" />
          </svg>
        </button>
        <p className="text-xs text-[var(--color-stone-500)]">
          Tap a chip, drag a strip, or speak a field name and a value.
        </p>
      </div>
    </div>
  );
}

interface SpeechRecognitionResultLike {
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { [index: number]: SpeechRecognitionResultLike; length: number };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}
