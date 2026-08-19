/**
 * Customer self-provided intake (PHASE 17.11, direct founder instruction
 * 2026-08-19): "a tool that lets me input the client's data they give
 * themselves when they become a customer, following a set of rules I set
 * in terms of data organization, which I will convert their data to
 * using some LLM, producing perhaps CLV or other [derived metrics]."
 *
 * Deliberately reuses the existing evidence-cited proposal pattern from
 * advisor-capture.ts rather than a parallel model: raw text a new
 * customer provides about themselves (name/contact/preferences/family
 * context) is one intake session; an AI pass proposes typed
 * `CustomerFact` rows from it, each provenance-classed
 * `customer_declared` (the customer authored this about themselves —
 * distinct from `advisor_observed`, which is a staff member's read of
 * someone else). Nothing writes to the canonical customer_facts table
 * until a proposal is confirmed, and — the same rule advisor-capture
 * enforces — a proposal whose cited excerpt is not an actual substring
 * of the raw intake text is refused before it is ever shown as
 * reviewable, let alone written. CLV/derived metrics are computed from
 * real orders (see intelligence/customer-segmentation.ts's
 * rankCustomersBySpend) once a real customer + real purchase history
 * exist — intake never fabricates a value for either.
 */

import type { CustomerFactType } from "./customer-fact";

export const CUSTOMER_INTAKE_PROPOSAL_STATUSES = [
  "proposed",
  "confirmed",
  "dismissed",
] as const;
export type CustomerIntakeProposalStatus =
  (typeof CUSTOMER_INTAKE_PROPOSAL_STATUSES)[number];

/** Only the CustomerFact types a NEW customer plausibly self-declares at
 * intake. `employer`/`industry`/`bonus_month` are deliberately excluded —
 * DECLARED_ONLY_FACT_TYPES in customer-fact.ts means they can never be
 * behaviour-inferred, but that is a different guarantee from "safe to
 * extract from a free-text intake form"; a founder-set organization rule
 * (see module docstring) governs what this narrower list actually is,
 * and this is the deliberately conservative starting point, not the
 * final list. */
export const CUSTOMER_INTAKE_FACT_TYPES = [
  "preference_concept",
  "occasion",
  "anniversary",
  "wedding_date",
  "travel_window",
  "fit_note",
  "fabric_interest",
  "colour_interest",
  "pattern_interest",
  "other",
] as const satisfies readonly CustomerFactType[];
export type CustomerIntakeFactType =
  (typeof CUSTOMER_INTAKE_FACT_TYPES)[number];

export interface CustomerIntakeProposal {
  readonly factType: CustomerIntakeFactType;
  readonly valueLabel: string;
  readonly valueText?: string;
  /** The exact substring of the raw intake text this proposal is
   * grounded in — never the AI's own restated conclusion. Mirrors
   * advisor-capture's sourceExcerpt exactly. */
  readonly sourceExcerpt: string;
  readonly confidence: number;
}

export type CustomerIntakeProposalCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "value_label_required" }
  | { readonly ok: false; readonly reason: "source_excerpt_required" }
  | {
      readonly ok: false;
      readonly reason: "source_excerpt_not_in_intake_text";
    }
  | { readonly ok: false; readonly reason: "invalid_confidence" }
  | { readonly ok: false; readonly reason: "unsupported_fact_type" };

/** The one real enforcement point: a proposal is only ever reviewable if
 * its cited excerpt genuinely appears in the raw text the customer typed.
 * Case-insensitive substring match, same as checkCaptureBundleProposal —
 * an LLM's paraphrase of "I love navy blazers" as "prefers navy" is not
 * grounded even though it is a fair summary, because the whole point of
 * citation is that a human reviewer can find the exact words themselves
 * without trusting the summary. */
export function checkCustomerIntakeProposal(args: {
  readonly rawIntakeText: string;
  readonly proposal: CustomerIntakeProposal;
}): CustomerIntakeProposalCheck {
  const { proposal, rawIntakeText } = args;

  if (
    !(CUSTOMER_INTAKE_FACT_TYPES as readonly string[]).includes(
      proposal.factType,
    )
  ) {
    return { ok: false, reason: "unsupported_fact_type" };
  }
  if (proposal.valueLabel.trim().length === 0) {
    return { ok: false, reason: "value_label_required" };
  }
  if (proposal.sourceExcerpt.trim().length === 0) {
    return { ok: false, reason: "source_excerpt_required" };
  }
  if (
    !rawIntakeText
      .toLowerCase()
      .includes(proposal.sourceExcerpt.trim().toLowerCase())
  ) {
    return { ok: false, reason: "source_excerpt_not_in_intake_text" };
  }
  if (
    !Number.isFinite(proposal.confidence) ||
    proposal.confidence < 0 ||
    proposal.confidence > 1
  ) {
    return { ok: false, reason: "invalid_confidence" };
  }
  return { ok: true };
}
