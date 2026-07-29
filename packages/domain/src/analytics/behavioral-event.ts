import type { InteractionEvent } from "../intelligence/interaction-event";

/**
 * Consent-aware interaction signal fed into analytics and advisor intelligence.
 * Upgraded in PHASE 3.1 per ADR-061; `name` is retained as an alias of
 * `interactionType` for backward-compatible aggregate counts.
 */
export type BehavioralEvent = InteractionEvent & {
  readonly name: InteractionEvent["interactionType"];
};

export function toBehavioralEventName(
  interactionType: InteractionEvent["interactionType"],
): InteractionEvent["interactionType"] {
  return interactionType;
}
