import type {
  LoyaltyBuiltInMilestoneKind,
  LoyaltyMilestoneAward,
} from "@paon/domain";

type BadgeDefinition = {
  id: string;
  title: string;
  detail: string;
  kind?: LoyaltyBuiltInMilestoneKind;
  hue: string;
  glyph: string;
};

const BADGES: readonly BadgeDefinition[] = [
  {
    id: "explore",
    title: "Explore the wardrobe",
    detail: "Your first look inside the Wardrobe environment.",
    hue: "linear-gradient(135deg, #d8e7c1, #a9c8a6 54%, #4c715d)",
    glyph: "◇",
  },
  {
    id: "first-commission",
    title: "First commission",
    detail: "Your first commissioned piece.",
    kind: "first_commission",
    hue: "linear-gradient(135deg, #e8d5a6, #b89552 54%, #5c4223)",
    glyph: "Ⅰ",
  },
  {
    id: "full-canvas",
    title: "Full-canvas suit",
    detail: "Experienced a hand-canvassed tailored suit.",
    kind: "premium_construction",
    hue: "linear-gradient(135deg, #d6cedf, #89799a 54%, #45394e)",
    glyph: "✦",
  },
  {
    id: "cashmere",
    title: "Cashmere overcoat",
    detail: "Added a cashmere overcoat to your repertoire.",
    kind: "advanced_fabric",
    hue: "linear-gradient(135deg, #d4c5b7, #9c7860 54%, #4e3730)",
    glyph: "⌁",
  },
  {
    id: "denim",
    title: "Made-to-measure denim",
    detail: "Commissioned denim made specifically for you.",
    kind: "new_category",
    hue: "linear-gradient(135deg, #b9cbd8, #57758c 54%, #293f50)",
    glyph: "∿",
  },
  {
    id: "return",
    title: "Returning client",
    detail: "Returned to refine, renew, or build further.",
    kind: "repeat_order",
    hue: "linear-gradient(135deg, #d4dfc5, #7a9165 54%, #3d5034)",
    glyph: "↺",
  },
];

function BadgeMark({ glyph }: { glyph: string }) {
  return (
    <span
      aria-hidden="true"
      className="border-current/45 font-brand relative grid h-14 w-14 place-items-center rounded-full border bg-black/20 text-2xl shadow-[inset_0_0_0_5px_rgba(255,255,255,.08),0_10px_24px_rgba(0,0,0,.24)]"
    >
      <i className="border-current/25 absolute inset-1 rounded-full border" />
      <b className="relative font-normal">{glyph}</b>
    </span>
  );
}

export function BadgesShelf({
  milestones,
}: {
  milestones: readonly LoyaltyMilestoneAward[];
}) {
  const earnedKinds = new Set<LoyaltyBuiltInMilestoneKind>();
  for (const award of milestones)
    if (award.status === "awarded" && award.kind !== "custom")
      earnedKinds.add(award.kind);
  const earnedCount = BADGES.filter(
    (badge) =>
      badge.id === "explore" || (badge.kind && earnedKinds.has(badge.kind)),
  ).length;
  const complete = earnedCount === BADGES.length;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {BADGES.map((badge) => {
        const earned =
          badge.id === "explore" ||
          (badge.kind ? earnedKinds.has(badge.kind) : false);
        return (
          <article
            key={badge.id}
            className={`relative min-h-40 overflow-hidden rounded-[24px] border p-5 transition-transform duration-300 hover:-translate-y-1 ${earned ? "border-white/20 text-white shadow-[0_18px_40px_rgba(0,0,0,.28)]" : "border-white/10 bg-[#101112] text-white/65 grayscale"}`}
            style={earned ? { background: badge.hue } : undefined}
          >
            <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_15%,white_0_1px,transparent_1.5px)] [background-size:8px_8px]" />
            <div className="relative flex h-full flex-col justify-between gap-5">
              <div className="flex items-start justify-between gap-4">
                <BadgeMark glyph={badge.glyph} />
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.15em] ${earned ? "border-white/35 bg-black/15" : "border-white/15 bg-white/5 text-white/45"}`}
                >
                  {earned ? "Earned" : "Locked"}
                </span>
              </div>
              <div>
                <h3 className="font-brand text-xl leading-none">
                  {badge.title}
                </h3>
                <p className="text-current/70 mt-2 max-w-[30ch] text-xs leading-5">
                  {badge.detail}
                </p>
              </div>
            </div>
          </article>
        );
      })}
      <article
        className={`relative overflow-hidden rounded-[24px] border p-5 ${complete ? "border-[#e8d5a6]/60 bg-gradient-to-br from-[#ead69e] via-[#a88448] to-[#342717] text-white" : "border-dashed border-white/25 bg-[#0b0c0d] text-white/75"}`}
      >
        <div className="flex h-full min-h-40 flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-brand text-2xl">✺</span>
            <span className="text-current/60 text-xs">
              {earnedCount}/{BADGES.length}
            </span>
          </div>
          <div>
            <p className="text-xl">The Complete Collection</p>
            <p className="text-current/65 mt-2 text-xs leading-5">
              {complete
                ? "Collection complete — your final reward is ready."
                : "Complete every badge to unlock the final reward."}
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
