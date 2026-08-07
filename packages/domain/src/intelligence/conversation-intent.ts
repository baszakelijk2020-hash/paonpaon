/**
 * PHASE 17.14: buying-intent classification for an inbound customer/guest
 * message. Deliberately a plain, published pattern catalogue — never an
 * opaque score, never an LLM call — so every escalation an advisor sees is
 * explainable back to the exact words that triggered it, the same
 * discipline `CustomerInterestProjection` already applies to browsing
 * evidence. A signal that cannot point to a real matched substring of the
 * message it came from is not a signal.
 */

export const BUYING_INTENT_LEVELS = [
  "low",
  "medium",
  "high",
  "very_high",
] as const;
export type BuyingIntentLevel = (typeof BUYING_INTENT_LEVELS)[number];

export type ConversationIntentSignalCode =
  | "occasion_wedding"
  | "occasion_first_suit"
  | "deadline_mentioned"
  | "appointment_readiness"
  | "asks_for_person"
  | "budget_discovery"
  | "urgency";

export interface ConversationIntentSignal {
  readonly code: ConversationIntentSignalCode;
  readonly label: string;
  /** The real, verbatim substring of the message that triggered this
   * signal — never a paraphrase, never invented. */
  readonly matchedText: string;
  readonly sourceMessageId?: string;
}

export interface BuyingIntentClassification {
  readonly level: BuyingIntentLevel;
  readonly signals: readonly ConversationIntentSignal[];
}

const SIGNAL_PATTERNS: ReadonlyArray<{
  readonly code: ConversationIntentSignalCode;
  readonly label: string;
  readonly pattern: RegExp;
}> = [
  {
    code: "occasion_wedding",
    label: "Wedding",
    pattern:
      /\b(wedding|getting married|my fianc[ée]e?|best man|groom(?:sm[ae]n)?)\b/i,
  },
  {
    code: "occasion_first_suit",
    label: "First suit / new to tailoring",
    pattern:
      /\b(never (?:bought|owned|had) a (?:proper )?suit|first (?:proper )?suit|no clue where to start|new to (?:suits|tailoring))\b/i,
  },
  {
    code: "deadline_mentioned",
    label: "Deadline",
    pattern:
      /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|by (?:next week|next month|friday|monday|tuesday|wednesday|thursday|saturday|sunday)|this (?:week|weekend|month)|before (?:the wedding|then))\b/i,
  },
  {
    code: "appointment_readiness",
    label: "Appointment readiness",
    pattern:
      /\b(can i come (?:in|by)?|book (?:an )?appointment|come in on|available (?:this )?(?:saturday|sunday|monday|tuesday|wednesday|thursday|friday)|can we meet|when can i visit)\b/i,
  },
  {
    code: "asks_for_person",
    label: "Asks for a person",
    pattern:
      /\b(speak to (?:someone|an advisor|a person)|talk to (?:someone|the team|an advisor)|can (?:someone|a person) call me|is there someone i can talk to)\b/i,
  },
  {
    code: "budget_discovery",
    label: "Budget discovery",
    pattern:
      /\b(how much (?:does|is|would)|what(?:'| i)?s the price|budget|price range|cost of a)\b/i,
  },
  {
    code: "urgency",
    label: "Urgency",
    pattern:
      /\b(urgent(?:ly)?|asap|as soon as possible|right away|need (?:it|this) fast)\b/i,
  },
];

/** Finds every real signal in one message, each carrying its own matched
 * substring. Order matches `SIGNAL_PATTERNS` and does not deduplicate a
 * code the message genuinely triggers more than once via distinct text. */
export function findConversationIntentSignals(
  text: string,
  sourceMessageId?: string,
): readonly ConversationIntentSignal[] {
  const signals: ConversationIntentSignal[] = [];
  for (const { code, label, pattern } of SIGNAL_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    signals.push({
      code,
      label,
      matchedText: match[0],
      ...(sourceMessageId ? { sourceMessageId } : {}),
    });
  }
  return signals;
}

/**
 * Explainable level from a set of already-found signals — a fixed,
 * published decision table, not a weighted/opaque score. Any two people
 * reading this function reach the same level for the same signal set.
 */
export function classifyBuyingIntentLevel(
  signals: readonly ConversationIntentSignal[],
): BuyingIntentLevel {
  const codes = new Set(signals.map((s) => s.code));
  if (codes.has("appointment_readiness")) return "very_high";
  if (
    codes.has("asks_for_person") &&
    (codes.has("deadline_mentioned") || codes.has("urgency"))
  ) {
    return "very_high";
  }
  if (
    codes.has("deadline_mentioned") &&
    (codes.has("occasion_wedding") || codes.has("occasion_first_suit"))
  ) {
    return "high";
  }
  if (codes.has("asks_for_person") || codes.has("urgency")) return "high";
  if (
    codes.has("budget_discovery") ||
    codes.has("occasion_wedding") ||
    codes.has("occasion_first_suit") ||
    codes.has("deadline_mentioned")
  ) {
    return "medium";
  }
  return "low";
}

export function classifyBuyingIntent(
  text: string,
  sourceMessageId?: string,
): BuyingIntentClassification {
  const signals = findConversationIntentSignals(text, sourceMessageId);
  return { level: classifyBuyingIntentLevel(signals), signals };
}

/** Whether a classification should flip a fresh AI-handled conversation
 * to needing a human — `very_high`/`high` or an explicit ask for a
 * person, matching this item's own acceptance criteria. */
export function conversationNeedsHuman(
  classification: BuyingIntentClassification,
): boolean {
  return (
    classification.level === "very_high" ||
    classification.level === "high" ||
    classification.signals.some((s) => s.code === "asks_for_person")
  );
}

/**
 * Defense-in-depth heuristic flag for the customer-AI security boundary
 * (VISION.md "customer AI security"). This is never the sole defense —
 * the load-bearing protection is scoped tools and allowlist-citation
 * validation the grounded-answer/draft-reply providers already enforce —
 * but a flagged message is surfaced to staff and excluded from
 * personalization-evidence capture, and this function is what the
 * permanent jailbreak-corpus test suite exercises.
 */
export const CONVERSATION_SAFETY_FLAGS = [
  "prompt_injection_attempt",
  "system_prompt_probe",
  "role_override_attempt",
  "encoded_instruction_suspected",
] as const;
export type ConversationSafetyFlag = (typeof CONVERSATION_SAFETY_FLAGS)[number];

export interface ConversationSafetyCheck {
  readonly flags: readonly ConversationSafetyFlag[];
}

const SAFETY_PATTERNS: ReadonlyArray<{
  readonly flag: ConversationSafetyFlag;
  readonly pattern: RegExp;
}> = [
  {
    flag: "prompt_injection_attempt",
    pattern:
      /\bignore (?:all |any )?(?:the )?(?:previous|prior|above)\s+instructions?\b/i,
  },
  {
    flag: "system_prompt_probe",
    pattern:
      /\b(reveal|show|print|repeat)\s+(?:your|the)\s+(?:system prompt|instructions|prompt)\b/i,
  },
  {
    flag: "system_prompt_probe",
    pattern: /\bwhat (?:is|are) your (?:system prompt|instructions)\b/i,
  },
  {
    flag: "role_override_attempt",
    pattern:
      /\byou are now\b|\bact as (?:an?|the)\s*(?:admin|administrator|developer|different)\b|\bpretend (?:you are|to be)\b|\bnew (?:instructions|persona)\s*:/i,
  },
  {
    flag: "role_override_attempt",
    pattern:
      /\bi am (?:the |an? )?(?:admin|administrator|developer)\b.*\b(override|bypass|disable)\b/i,
  },
  {
    // A long unbroken base64-alphabet run — plausible encoded-instruction
    // smuggling, never triggered by ordinary sentences.
    flag: "encoded_instruction_suspected",
    pattern: /(?:[A-Za-z0-9+/]{4}){10,}={0,2}/,
  },
];

export function checkConversationSafety(text: string): ConversationSafetyCheck {
  const flags = new Set<ConversationSafetyFlag>();
  for (const { flag, pattern } of SAFETY_PATTERNS) {
    if (pattern.test(text)) flags.add(flag);
  }
  return { flags: [...flags] };
}
