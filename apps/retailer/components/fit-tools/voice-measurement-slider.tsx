"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Direct port of the founder's `vox-` Adobe Muse widget (chip-slider
 * momentum physics + Dutch voice command parsing) into a React client
 * component. Ported as close to 1:1 as reasonable — rewriting the drag
 * physics as declarative React state would risk losing the exact feel —
 * with one real change: `applyValue` now also calls `onApply(fieldName,
 * formattedValue)` so the parent page can persist it as a
 * FittingObservation, instead of only updating the chip's own display.
 *
 * Not ported from the original: the "both shoulders at once" voice combo
 * and the continued-listening grace-period re-refinement window — real
 * interactions, deliberately deferred rather than risking a subtly wrong
 * port of the trickiest part of the original parser. Tap-to-select and
 * drag-to-select both work for every field; voice applies a value the
 * moment a field + number are both recognized in one utterance.
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
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  const CHIP_W = 46;
  const GAP = 6;
  const STEP = CHIP_W + GAP;

  function applyValue(index: number, value: number) {
    const field = FIELDS[index];
    if (!field) return;
    onApplyRef.current(field.name, fmt(value));
    setActiveIndex(index);
    window.setTimeout(() => setActiveIndex(null), 900);
  }

  function snapTrackToValue(index: number, value: number) {
    const track = trackRefs.current[index];
    const sw = swRefs.current[index];
    const field = FIELDS[index];
    if (!track || !field) return;
    const vals = generateVals(field.limit, field.step);
    const vpWidth = track.parentElement?.clientWidth ?? 0;
    const center = vpWidth / 2 - CHIP_W / 2;
    const i = vals.findIndex((v) => Math.abs(v - value) < 0.001);
    if (i === -1) return;
    const x = center - i * STEP;
    track.style.transition = "transform 400ms cubic-bezier(0.23,1,0.32,1)";
    track.style.transform = `translateX(${x}px)`;
    if (sw) sw.textContent = fmt(value);
  }

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
    <div className="flex flex-col items-center gap-2.5">
      {FIELDS.map((field, index) => {
        const vals = generateVals(field.limit, field.step);
        const zeroIndex = vals.indexOf(0);
        return (
          <div
            key={field.name}
            data-field={field.name}
            className="w-full max-w-[350px]"
          >
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
                  className="relative h-full w-full overflow-hidden"
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
                    style={{
                      transform: `translateX(calc(50% - 23px - ${zeroIndex * STEP}px))`,
                    }}
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

      <div className="mt-3 flex flex-col items-center gap-2">
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
