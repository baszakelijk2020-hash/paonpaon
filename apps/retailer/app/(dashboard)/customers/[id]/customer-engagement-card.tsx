import type {
  CampaignChallengeEnrollment,
  CampaignRewardGrant,
} from "@paon/domain";
import { Card } from "@paon/ui/components/Card";

const WHEN = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * What this customer did with the campaigns and private offers the retailer
 * published to them.
 *
 * The whole loop — enrol, save a look, complete, be granted a reward — ran
 * with no retailer-side surface at all. A completed challenge was as invisible
 * to staff as one that never happened, so nobody could follow up on it or
 * honour the reward in person. All three tables already carry a
 * "retailer staff read tenant …" policy.
 */
export function CustomerEngagementCard({
  enrollments,
  rewardGrants,
  campaignNameById,
}: {
  enrollments: readonly CampaignChallengeEnrollment[];
  rewardGrants: readonly CampaignRewardGrant[];
  campaignNameById: ReadonlyMap<string, string>;
}) {
  if (enrollments.length === 0 && rewardGrants.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <h2 className="font-display text-lg text-[var(--color-stone-900)]">
        Campaigns and offers
      </h2>
      <p className="text-sm text-[var(--color-stone-500)]">
        What they took part in, and what they earned.
      </p>

      {enrollments.length > 0 ? (
        <ul className="mt-4 flex flex-col divide-y divide-white/10">
          {enrollments.map((entry) => (
            <li
              key={entry.id as string}
              className="flex flex-wrap items-baseline justify-between gap-2 py-3"
            >
              <span className="text-sm text-[var(--color-stone-900)]">
                {campaignNameById.get(entry.campaignId as string) ?? "Campaign"}
              </span>
              <span className="text-xs text-[var(--color-stone-500)]">
                {entry.status.replace(/_/g, " ")} · started{" "}
                {WHEN.format(new Date(entry.startedAt))}
                {entry.completedAt
                  ? ` · completed ${WHEN.format(new Date(entry.completedAt))}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {rewardGrants.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs uppercase text-[var(--color-stone-500)]">
            Rewards granted
          </p>
          <ul className="mt-2 flex flex-col divide-y divide-white/10">
            {rewardGrants.map((grant) => (
              <li
                key={grant.id as string}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
              >
                <span className="text-sm text-[var(--color-stone-900)]">
                  {grant.label}
                </span>
                <span className="text-xs text-[var(--color-stone-500)]">
                  {grant.rewardKind.replace(/_/g, " ")}
                  {grant.expiresAt
                    ? ` · expires ${WHEN.format(new Date(grant.expiresAt))}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
