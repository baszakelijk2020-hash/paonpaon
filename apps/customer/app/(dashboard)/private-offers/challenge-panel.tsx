"use client";

import { WARDROBE_CHALLENGE_REQUIRED_SLOTS } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";

import {
  completeChallenge,
  saveDayLook,
  startChallenge,
  type PrivateOfferGroup,
} from "./actions";

interface ChallengePanelProps {
  readonly group: PrivateOfferGroup;
}

export function ChallengePanel({ group }: ChallengePanelProps) {
  if (group.eligibleChallenges.length === 0) {
    return (
      <p role="status" className="text-sm text-[var(--color-stone-500)]">
        No seven-day wardrobe challenges are available for this house right now.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {group.eligibleChallenges.map((campaign) => {
        const enrollment = group.enrollmentDetails.find(
          (entry) => entry.enrollment.campaignId === campaign.id,
        );
        const reward = group.rewards.find(
          (entry) => entry.campaignId === campaign.id,
        );

        return (
          <section
            key={campaign.id}
            aria-labelledby={`challenge-${campaign.id}`}
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4"
          >
            <h3
              id={`challenge-${campaign.id}`}
              className="font-display text-lg text-[var(--color-stone-900)]"
            >
              {campaign.title}
            </h3>
            {campaign.description ? (
              <p className="mt-1 text-sm text-[var(--color-stone-600)]">
                {campaign.description}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-[var(--color-stone-500)]">
              Compose seven complete catalogue looks. Reward:{" "}
              {campaign.rewardKind?.replaceAll("_", " ") ?? "none configured"}.
            </p>

            {!enrollment ? (
              <form action={startChallenge} className="mt-4">
                <input
                  type="hidden"
                  name="retailerId"
                  value={group.retailerId}
                />
                <input
                  type="hidden"
                  name="customerId"
                  value={group.customerId}
                />
                <input type="hidden" name="campaignId" value={campaign.id} />
                <Button type="submit" size="sm">
                  Start challenge
                </Button>
              </form>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {Array.from({ length: 7 }, (_, index) => {
                  const dayIndex = index + 1;
                  const dayLook = enrollment.dayLooks.find(
                    (look) => look.dayIndex === dayIndex,
                  );
                  const complete =
                    dayLook &&
                    group.isWardrobeChallengeDayComplete(dayLook.slots);
                  return (
                    <form
                      key={dayIndex}
                      action={saveDayLook}
                      className="rounded border border-[var(--color-stone-100)] p-3"
                    >
                      <input
                        type="hidden"
                        name="enrollmentId"
                        value={enrollment.enrollment.id}
                      />
                      <input
                        type="hidden"
                        name="customerId"
                        value={group.customerId}
                      />
                      <input type="hidden" name="dayIndex" value={dayIndex} />
                      <p className="text-sm font-medium text-[var(--color-stone-800)]">
                        Day {dayIndex}{" "}
                        {complete ? (
                          <span className="text-[var(--color-stone-500)]">
                            · complete
                          </span>
                        ) : null}
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {WARDROBE_CHALLENGE_REQUIRED_SLOTS.map((slotKind) => (
                          <label
                            key={slotKind}
                            className="flex flex-col gap-1 text-xs"
                          >
                            <span className="capitalize text-[var(--color-stone-600)]">
                              {slotKind.replaceAll("_", " ")}
                            </span>
                            <select
                              name={slotKind}
                              defaultValue={dayLook?.slots[slotKind] ?? ""}
                              className="rounded border border-[var(--color-stone-200)] px-2 py-1.5 text-sm"
                            >
                              <option value="">Select product</option>
                              {group.activeProducts.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="mt-3"
                      >
                        Save day {dayIndex}
                      </Button>
                    </form>
                  );
                })}

                {reward ? (
                  <p
                    role="status"
                    className="rounded bg-[var(--color-stone-50)] px-3 py-2 text-sm text-[var(--color-stone-700)]"
                  >
                    Reward issued: {reward.rewardKind.replaceAll("_", " ")} ·
                    code {reward.code}
                    {reward.expiresAt
                      ? ` · expires ${new Date(reward.expiresAt).toLocaleDateString()}`
                      : ""}
                  </p>
                ) : (
                  <form action={completeChallenge}>
                    <input
                      type="hidden"
                      name="enrollmentId"
                      value={enrollment.enrollment.id}
                    />
                    <input
                      type="hidden"
                      name="customerId"
                      value={group.customerId}
                    />
                    <Button type="submit" size="sm">
                      Complete challenge and claim reward
                    </Button>
                  </form>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
