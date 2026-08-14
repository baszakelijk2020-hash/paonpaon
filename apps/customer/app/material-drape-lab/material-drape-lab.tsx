"use client";

import { useEffect, useState } from "react";

type FabricId = "airy-twill" | "resilient-wool" | "structured-mohair";
type StateId = "rest" | "reach" | "seated";
type LightId = "north" | "gallery" | "evening";

const FABRICS: Record<
  FabricId,
  {
    name: string;
    description: string;
    colour: string;
    edge: string;
    texture: string;
  }
> = {
  "airy-twill": {
    name: "Airy twill",
    description:
      "A light, yielding comparison profile. The illustrated fold reads soft and open.",
    colour: "#768598",
    edge: "#d6e0e3",
    texture: "fine diagonal",
  },
  "resilient-wool": {
    name: "Resilient wool",
    description:
      "A balanced comparison profile. The illustrated fold returns to a composed line.",
    colour: "#3f5963",
    edge: "#b7cbd1",
    texture: "quiet melange",
  },
  "structured-mohair": {
    name: "Structured mohair",
    description:
      "A crisp comparison profile. The illustrated fold holds a sharper, more luminous edge.",
    colour: "#263f47",
    edge: "#e5d3ac",
    texture: "dry grain",
  },
};

const STATES: Record<StateId, { name: string; detail: string }> = {
  rest: { name: "At rest", detail: "Baseline front balance and lapel roll." },
  reach: {
    name: "In reach",
    detail: "An illustrative opening across the chest and sleeve.",
  },
  seated: {
    name: "Seated",
    detail: "An illustrative compression at the waist and front.",
  },
};

const LIGHTS: Record<
  LightId,
  { name: string; detail: string; background: string }
> = {
  north: {
    name: "North light",
    detail: "Soft, cool shape reading.",
    background: "#d9e3e2",
  },
  gallery: {
    name: "Gallery",
    detail: "Neutral surface and construction reading.",
    background: "#dedbd2",
  },
  evening: {
    name: "Evening",
    detail: "Warm edge and surface reading.",
    background: "#463e3d",
  },
};

function JacketIllustration({
  fabric,
  state,
  light,
}: {
  fabric: FabricId;
  state: StateId;
  light: LightId;
}) {
  const profile = FABRICS[fabric];
  const stateOffset = state === "reach" ? 10 : state === "seated" ? 5 : 0;
  const foldOpacity = state === "rest" ? 0.18 : state === "reach" ? 0.38 : 0.48;
  const lightOpacity =
    light === "north" ? 0.12 : light === "evening" ? 0.34 : 0.2;
  return (
    <svg
      aria-hidden="true"
      className="h-full w-full"
      viewBox="0 0 560 700"
      role="img"
    >
      <defs>
        <linearGradient id="jacket-shadow" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor={profile.edge} stopOpacity="0.62" />
          <stop offset="0.52" stopColor={profile.colour} />
          <stop offset="1" stopColor="#0d1d22" stopOpacity="0.55" />
        </linearGradient>
        <pattern
          id="twill"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-24)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="16"
            stroke={profile.edge}
            strokeOpacity="0.22"
            strokeWidth="2"
          />
        </pattern>
      </defs>
      <ellipse
        cx="280"
        cy="655"
        rx="178"
        ry="22"
        fill="#132025"
        opacity="0.2"
      />
      <path
        d={`M191 104 242 73h76l51 31 80 ${156 + stateOffset} -38 64-35-18-4 292H188l-4-292-35 18-38-64z`}
        fill="url(#jacket-shadow)"
      />
      <path
        d="M191 104 242 73h76l51 31 80 156-38 64-35-18-4 292H188l-4-292-35 18-38-64z"
        fill={light === "evening" ? "#cb9760" : "#eaf4f1"}
        opacity={lightOpacity}
      />
      <path
        d={`M191 104 242 73h76l51 31 80 ${156 + stateOffset} -38 64-35-18-4 292H188l-4-292-35 18-38-64z`}
        fill="url(#twill)"
        opacity="0.72"
      />
      <path d="m242 73 38 108 38-108-38-24z" fill="#202f35" opacity="0.75" />
      <path
        d="m192 105 87 76-53 84-43-49zM368 105l-87 76 53 84 43-49z"
        fill="#15262c"
        opacity="0.5"
      />
      <path
        d="M280 181v402"
        stroke={profile.edge}
        strokeOpacity="0.5"
        strokeWidth="2"
      />
      <path
        d={`M205 270c33 ${30 + stateOffset} 57 ${36 + stateOffset} 74 50M354 270c-33 ${30 + stateOffset} -57 ${36 + stateOffset} -74 50M214 390c28 ${16 + stateOffset} 46 19 65 36M346 390c-28 ${16 + stateOffset} -46 19 -65 36`}
        fill="none"
        stroke={profile.edge}
        strokeOpacity={foldOpacity}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M198 360h56M306 360h56"
        stroke={profile.edge}
        strokeOpacity="0.62"
        strokeWidth="3"
      />
      <circle cx="280" cy="333" r="5" fill={profile.edge} opacity="0.8" />
      <circle cx="280" cy="371" r="5" fill={profile.edge} opacity="0.8" />
    </svg>
  );
}

export function MaterialDrapeLab() {
  const [fabric, setFabric] = useState<FabricId>("resilient-wool");
  const [state, setState] = useState<StateId>("rest");
  const [light, setLight] = useState<LightId>("gallery");
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 220);
    return () => window.clearTimeout(timer);
  }, [fabric, state, light]);

  const activeFabric = FABRICS[fabric];
  const activeState = STATES[state];
  const activeLight = LIGHTS[light];

  return (
    <main className="min-h-screen bg-[#e7e5df] px-4 py-5 text-[#18272b] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-[#18272b]/20 pb-5">
          <div>
            <p className="font-accent text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#58666a]">
              PAON research instrument · v0.1
            </p>
            <h1 className="font-display mt-2 text-4xl tracking-tight sm:text-5xl">
              Material &amp; Drape Lab
            </h1>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#4a5b5e]">
            Compare an illustrated jacket under a fixed construction. This is a
            deterministic research harness, not a fit, price or garment-ordering
            tool.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section
            className="relative min-h-[31rem] overflow-hidden border border-[#18272b]/20 bg-[#dedbd2] shadow-[12px_12px_0_rgba(24,39,43,0.08)]"
            aria-label="Jacket comparison"
          >
            <div
              className="absolute inset-0 transition-colors duration-300"
              style={{ backgroundColor: activeLight.background }}
            />
            <div className="absolute left-5 top-5 z-10 border border-[#18272b]/15 bg-[#f5f3ed]/80 px-3 py-2 text-xs backdrop-blur">
              <span className="font-semibold">Neutral test garment</span>
              <br />
              Original procedural illustration · no physical accuracy claim
            </div>
            <div
              className="absolute bottom-5 left-5 z-10 flex gap-2"
              aria-live="polite"
            >
              <span className="border border-[#18272b]/20 bg-[#f5f3ed]/85 px-2 py-1 text-xs">
                {activeFabric.texture}
              </span>
              <span className="border border-[#18272b]/20 bg-[#f5f3ed]/85 px-2 py-1 text-xs">
                {activeState.name}
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 top-14 mx-auto max-w-[34rem] p-5">
              {fallback ? (
                <div className="flex h-full items-center justify-center bg-[#f5f3ed]/75 p-8 text-center text-sm leading-6 text-[#405255]">
                  Static poster mode. The same cloth and state labels remain
                  available without GPU rendering.
                </div>
              ) : (
                <JacketIllustration
                  fabric={fabric}
                  state={state}
                  light={light}
                />
              )}
            </div>
            {loading ? (
              <div className="absolute inset-0 grid place-items-center bg-[#f5f3ed]/35 text-xs uppercase tracking-[0.16em]">
                Loading deterministic state…
              </div>
            ) : null}
          </section>

          <aside className="space-y-5" aria-label="Comparison controls">
            <fieldset className="border border-[#18272b]/20 bg-[#f4f2ec] p-4">
              <legend className="font-accent px-1 text-xs font-semibold uppercase tracking-[0.16em]">
                Cloth character
              </legend>
              <div className="mt-3 grid gap-2">
                {(Object.keys(FABRICS) as FabricId[]).map((id) => (
                  <label
                    key={id}
                    className={`cursor-pointer border p-3 text-sm ${fabric === id ? "border-[#18272b] bg-[#d7e0df]" : "border-[#18272b]/20"}`}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="fabric"
                      checked={fabric === id}
                      onChange={() => setFabric(id)}
                    />
                    {FABRICS[id].name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="border border-[#18272b]/20 bg-[#f4f2ec] p-4">
              <legend className="font-accent px-1 text-xs font-semibold uppercase tracking-[0.16em]">
                Drape state
              </legend>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(Object.keys(STATES) as StateId[]).map((id) => (
                  <label
                    key={id}
                    className={`cursor-pointer border px-2 py-3 text-center text-xs ${state === id ? "border-[#18272b] bg-[#d7e0df]" : "border-[#18272b]/20"}`}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="state"
                      checked={state === id}
                      onChange={() => setState(id)}
                    />
                    {STATES[id].name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="border border-[#18272b]/20 bg-[#f4f2ec] p-4">
              <legend className="font-accent px-1 text-xs font-semibold uppercase tracking-[0.16em]">
                Light context
              </legend>
              <div className="mt-3 grid gap-2">
                {(Object.keys(LIGHTS) as LightId[]).map((id) => (
                  <label
                    key={id}
                    className={`cursor-pointer border p-2 text-sm ${light === id ? "border-[#18272b] bg-[#d7e0df]" : "border-[#18272b]/20"}`}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="light"
                      checked={light === id}
                      onChange={() => setLight(id)}
                    />
                    {LIGHTS[id].name}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              className="w-full border border-[#18272b] px-3 py-3 text-sm font-semibold hover:bg-[#18272b] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18272b]"
              onClick={() => setFallback((value) => !value)}
            >
              {fallback ? "Resume illustration" : "Test static fallback"}
            </button>
          </aside>
        </div>
        <section className="mt-5 grid gap-4 border-t border-[#18272b]/20 pt-5 sm:grid-cols-3">
          <div>
            <p className="font-accent text-xs uppercase tracking-[0.16em] text-[#58666a]">
              Selected cloth
            </p>
            <p className="mt-1 text-sm leading-6">{activeFabric.description}</p>
          </div>
          <div>
            <p className="font-accent text-xs uppercase tracking-[0.16em] text-[#58666a]">
              Selected state
            </p>
            <p className="mt-1 text-sm leading-6">{activeState.detail}</p>
          </div>
          <div>
            <p className="font-accent text-xs uppercase tracking-[0.16em] text-[#58666a]">
              Selected light
            </p>
            <p className="mt-1 text-sm leading-6">{activeLight.detail}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
