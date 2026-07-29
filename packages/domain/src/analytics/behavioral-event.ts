/**
 * @deprecated Prefer `InteractionEvent` from `../intelligence/interaction-event`.
 * Re-exported so existing analytics imports keep compiling during the PHASE 3.1
 * upgrade; the runtime shape now requires consent/retention fields.
 */
export type {
  BehavioralEvent,
  InteractionEvent,
  InteractionEventName,
  InteractionEventSource,
  RetentionClass,
} from "../intelligence/interaction-event";
export {
  DEFAULT_INTERACTION_PURPOSE,
  DEFAULT_RETENTION_CLASS,
  INTERACTION_EVENT_NAMES,
  INTERACTION_EVENT_SOURCES,
  RETENTION_CLASSES,
  isInteractionEventName,
  validateCaptureInteractionEvent,
} from "../intelligence/interaction-event";
