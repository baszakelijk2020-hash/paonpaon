import {
  LOYALTY_BUILT_IN_MILESTONE_KINDS,
  LOYALTY_MILESTONE_KIND_LABELS,
  type LoyaltyBuiltInMilestoneKind,
  type LoyaltyMilestoneAward,
} from "@paon/domain";

const BADGE_EMOJI: Record<LoyaltyBuiltInMilestoneKind, string> = {
  first_commission: "🥇",
  repeat_order: "🔁",
  new_category: "🧭",
  premium_construction: "🧵",
  advanced_fabric: "💎",
};

/**
 * A visual achievement wall over the same real LoyaltyMilestoneAward data
 * the text list below already shows — earned/locked, no new schema. Custom
 * (house-defined) milestones aren't shown here since they have no fixed
 * slot to render in; they stay in the text list only.
 */
export function BadgesShelf({
  milestones,
}: {
  milestones: readonly LoyaltyMilestoneAward[];
}) {
  const earnedByKind = new Map<
    LoyaltyBuiltInMilestoneKind,
    LoyaltyMilestoneAward
  >();
  for (const award of milestones) {
    if (award.status !== "awarded" || award.kind === "custom") continue;
    if (!earnedByKind.has(award.kind)) {
      earnedByKind.set(award.kind, award);
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {LOYALTY_BUILT_IN_MILESTONE_KINDS.map((kind) => {
        const earned = earnedByKind.get(kind);
        return (
          <div
            key={kind}
            className={`customer-panel flex flex-col items-center gap-1 p-3 text-center ${
              earned ? "bg-white/70" : "bg-transparent opacity-50"
            }`}
          >
            <span aria-hidden="true" className="text-2xl">
              {BADGE_EMOJI[kind]}
            </span>
            <span className="text-xs font-medium text-[var(--color-stone-900)]">
              {LOYALTY_MILESTONE_KIND_LABELS[kind]}
            </span>
            <span className="text-[10px] text-[var(--color-stone-500)]">
              {earned ? "Earned" : "Not yet"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
