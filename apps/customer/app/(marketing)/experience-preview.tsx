"use client";

import { useState } from "react";

const VIEWS = {
  advisor: {
    label: "Sales advisor",
    eyebrow: "Relationship workspace",
    title: "Isabelle Laurent",
    note: "Prefers quiet appointments. Preparing for a September wedding in Florence.",
    metrics: [
      ["Next moment", "Fitting · 14:30"],
      ["Relationship", "Private client"],
      ["Wardrobe", "8 garments"],
    ],
    action: "Prepare the fitting",
  },
  workshop: {
    label: "Workshop",
    eyebrow: "Garment journey",
    title: "Midnight dinner jacket",
    note: "Sleeve balance approved. Hand-finish buttonholes before completion review.",
    metrics: [
      ["Work order", "ALT-0248"],
      ["Due", "Tomorrow"],
      ["Progress", "62%"],
    ],
    action: "Open approved work",
  },
  customer: {
    label: "Private client",
    eyebrow: "Your next moment",
    title: "Your jacket is taking shape.",
    note: "The workroom has completed the fitting adjustments. Quality review is next.",
    metrics: [
      ["Atelier", "Maison Dubois"],
      ["Status", "In progress"],
      ["Advisor", "Camille"],
    ],
    action: "View garment story",
  },
} as const;

type ViewKey = keyof typeof VIEWS;

export function ExperiencePreview() {
  const [active, setActive] = useState<ViewKey>("advisor");
  const view = VIEWS[active];

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-black/10 bg-[#ededea] shadow-[0_20px_60px_rgba(0,0,0,.2)]">
      <div className="flex gap-1 overflow-x-auto border-b border-black/10 p-2">
        {(Object.keys(VIEWS) as ViewKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            aria-pressed={active === key}
            className={`min-h-11 whitespace-nowrap rounded-md px-4 text-xs transition-colors ${
              active === key ? "bg-[#1a1a1a] text-white" : "bg-white/60"
            }`}
          >
            {VIEWS[key].label}
          </button>
        ))}
      </div>
      <div className="grid min-h-[32rem] md:grid-cols-[15rem_1fr]">
        <aside className="hidden bg-gradient-to-r from-[#333] to-[#1a1a1a] p-6 text-white md:block">
          <p className="font-[var(--font-display)] tracking-[0.22em]">PAON</p>
          <div className="mt-16 space-y-5 text-xs text-white/45">
            <p className="border-l border-white pl-3 text-white">Today</p>
            <p>Relationships</p>
            <p>Appointments</p>
            <p>Garment work</p>
            <p>Conversations</p>
          </div>
        </aside>
        <div className="p-5 sm:p-8">
          <div className="rounded-[1.25rem] bg-[#1a1a1a] p-7 text-white sm:p-9">
            <p className="text-[10px] font-[var(--font-accent)] uppercase tracking-[0.2em] text-white/50">
              {view.eyebrow}
            </p>
            <h3 className="mt-5 text-4xl font-[var(--font-display)] leading-none sm:text-5xl">
              {view.title}
            </h3>
            <p className="mt-5 max-w-xl text-sm leading-6 text-white/65">
              {view.note}
            </p>
            <button className="mt-7 min-h-11 rounded-sm bg-white px-5 text-xs font-medium text-black">
              {view.action} →
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-black/10 bg-white">
            {view.metrics.map(([label, value]) => (
              <div key={label} className="border-r p-4 last:border-r-0">
                <p className="text-[10px] text-black/45">{label}</p>
                <p className="mt-2 text-xs font-medium sm:text-sm">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-black/10 bg-white p-5">
            <div className="flex items-center justify-between text-xs">
              <span>Fitting captured</span>
              <span className="text-black/40">Workshop review</span>
              <span className="text-black/40">Ready</span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/10">
              <div className="h-full w-[58%] bg-black" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
