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

const BADGE_TREATMENT: Record<LoyaltyBuiltInMilestoneKind, string> = {
  first_commission: "linear-gradient(135deg, #56665a 0%, #222b24 100%)",
  repeat_order: "linear-gradient(135deg, #7c8772 0%, #3f493b 100%)",
  new_category: "linear-gradient(135deg, #8e7762 0%, #40342c 100%)",
  premium_construction: "linear-gradient(135deg, #5f4d49 0%, #302624 100%)",
  advanced_fabric: "linear-gradient(135deg, #6b7360 0%, #2c3428 100%)",
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
            className={`flex flex-col items-center gap-1 rounded-[var(--customer-radius)] p-3 text-center ${
              earned ? "text-white" : "opacity-60"
            }`}
            style={
              earned
                ? { background: BADGE_TREATMENT[kind] }
                : { background: "rgba(203, 211, 197, 0.35)" }
            }
          >
            <span aria-hidden="true" className="text-2xl">
              {BADGE_EMOJI[kind]}
            </span>
            <span
              className={`text-xs font-medium ${earned ? "text-white" : "text-[var(--color-stone-900)]"}`}
            >
              {LOYALTY_MILESTONE_KIND_LABELS[kind]}
            </span>
            <span
              className={`text-[10px] ${earned ? "text-white/80" : "text-[var(--color-stone-500)]"}`}
            >
              {earned ? "Earned" : "Not yet"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
