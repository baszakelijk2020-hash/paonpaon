"use client";

import type { LoyaltyTier } from "@paon/domain";
import { useState, type PointerEvent } from "react";

const TIERS: ReadonlyArray<{
  tier: LoyaltyTier;
  finish: string;
  clothScale: string;
}> = [
  {
    tier: "metre",
    finish: "from-[#626365] via-[#343638] to-[#171819]",
    clothScale:
      "96px 96px, 96px 96px, 96px 96px, 96px 96px, 24px 24px, 24px 24px",
  },
  {
    tier: "milli",
    finish: "from-[#626365] via-[#343638] to-[#171819]",
    clothScale:
      "224px 224px, 224px 224px, 224px 224px, 224px 224px, 56px 56px, 56px 56px",
  },
  {
    tier: "micron",
    finish: "from-[#626365] via-[#343638] to-[#171819]",
    clothScale:
      "480px 480px, 480px 480px, 480px 480px, 480px 480px, 120px 120px, 120px 120px",
  },
];

function clothPattern(): string {
  return "linear-gradient(90deg, transparent 0 9%, rgba(232,233,229,.54) 9.5% 10.4%, transparent 11% 26%, rgba(25,27,29,.64) 27% 29%, transparent 30% 48%, rgba(232,233,229,.3) 48.5% 49.3%, transparent 50% 72%, rgba(25,27,29,.74) 72.6% 75%, transparent 75.6% 100%), linear-gradient(0deg, transparent 0 9%, rgba(232,233,229,.5) 9.5% 10.4%, transparent 11% 26%, rgba(25,27,29,.66) 27% 29%, transparent 30% 48%, rgba(232,233,229,.28) 48.5% 49.3%, transparent 50% 72%, rgba(25,27,29,.76) 72.6% 75%, transparent 75.6% 100%), linear-gradient(90deg, transparent 0 1.2%, rgba(246,246,241,.55) 1.3% 1.65%, transparent 1.75% 100%), linear-gradient(0deg, transparent 0 1.2%, rgba(246,246,241,.5) 1.3% 1.65%, transparent 1.75% 100%), repeating-linear-gradient(45deg, rgba(255,255,255,.16) 0 .65px, transparent .65px 2.6px), repeating-linear-gradient(-45deg, rgba(0,0,0,.2) 0 .65px, transparent .65px 2.6px)";
}

export function LoyaltyTierCards({
  name,
  currentTier,
  completedSets,
}: {
  name: string;
  currentTier: LoyaltyTier;
  completedSets: number;
}) {
  void name;
  void currentTier;
  void completedSets;
  const [rotation, setRotation] = useState<Record<LoyaltyTier, string>>({
    milli: "0deg, 0deg",
    metre: "0deg, 0deg",
    micron: "0deg, 0deg",
  });
  const move = (tier: LoyaltyTier, event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    setRotation((current) => ({
      ...current,
      [tier]: `${-y * 10}deg, ${x * 12}deg`,
    }));
  };
  return (
    <section
      aria-label="Membership cards"
      className="grid gap-4 lg:grid-cols-3"
    >
      {TIERS.map(({ tier, finish, clothScale }) => {
        const cardRotation = rotation[tier] ?? "0deg, 0deg";
        const [rotateX, rotateY] = cardRotation.split(", ");
        return (
          <article
            key={tier}
            onPointerMove={(event) => move(tier, event)}
            onPointerLeave={() =>
              setRotation((value) => ({ ...value, [tier]: "0deg, 0deg" }))
            }
            className={`group relative aspect-[1.586/1] overflow-hidden rounded-[24px] border border-white/20 bg-gradient-to-br p-6 shadow-[0_24px_60px_rgba(0,0,0,.48)] transition-transform duration-150 ${finish}`}
            style={{
              transform: `perspective(900px) rotateX(${rotateX}) rotateY(${rotateY})`,
            }}
          >
            <div
              className="absolute inset-0 opacity-90"
              style={{
                backgroundImage: clothPattern(),
                backgroundSize: clothScale,
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,.34),transparent_38%),linear-gradient(115deg,rgba(255,255,255,.14),transparent_35%,rgba(0,0,0,.28)_80%)]" />
            <div className="absolute -bottom-20 -left-10 h-44 w-72 -rotate-12 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-xl transition-transform duration-150 group-hover:translate-x-16" />
            <div className="absolute inset-3 rounded-[17px] border border-white/30" />
            <div className="relative h-full">
              <span className="font-brand absolute left-0 top-0 text-[11px] tracking-[0.15em] text-white/90">
                Nebel &amp; Spiegel
              </span>
              <span
                className="absolute bottom-1 left-0 block whitespace-nowrap text-[clamp(2rem,3.25vw,4.25rem)] leading-[0.82] tracking-[-0.045em] text-white drop-shadow-[0_2px_1px_rgba(0,0,0,.45)]"
                style={{
                  fontFamily: '"NS Serrif", "Customer Display", serif',
                }}
              >
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </span>
            </div>
          </article>
        );
      })}
    </section>
  );
}
