/**
 * Post-appointment closeout drafts (CLI-006 / PHASE 7.5).
 * Reuses advisor rectangles; never invents facts without selections.
 */

import {
  factsFromAdvisorRectangles,
  type AdvisorRectangleKind,
} from "../intelligence/customer-fact";
import { asId } from "../shared/branded-id";
import type {
  AppointmentId,
  CustomerId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";

export interface AppointmentCloseoutInput {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly appointmentId: AppointmentId;
  readonly authorStaffId: StaffId;
  readonly observedAt: string;
  readonly selections: readonly {
    readonly conceptId: string;
    readonly kind: AdvisorRectangleKind;
    readonly label: string;
    readonly polarity: "positive" | "negative";
  }[];
  readonly freeformNote?: string;
  readonly nextStep?: string;
  readonly followUpDate?: string;
}

export function buildAppointmentCloseoutNote(
  input: Pick<
    AppointmentCloseoutInput,
    "appointmentId" | "freeformNote" | "nextStep" | "followUpDate"
  >,
): string {
  return [
    `appointment:${input.appointmentId}`,
    input.freeformNote?.trim(),
    input.nextStep?.trim() ? `next_step:${input.nextStep.trim()}` : undefined,
    input.followUpDate?.trim()
      ? `follow_up:${input.followUpDate.trim()}`
      : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" | ");
}

export function buildAppointmentCloseout(input: AppointmentCloseoutInput) {
  const freeformNote = buildAppointmentCloseoutNote(input);
  if (input.selections.length === 0) {
    return {
      ok: false as const,
      errors: ["empty_selections" as const],
      drafts: [],
      freeformNote,
    };
  }
  const result = factsFromAdvisorRectangles({
    retailerId: input.retailerId,
    customerId: input.customerId,
    authorStaffId: input.authorStaffId,
    observedAt: input.observedAt,
    selections: input.selections.map((selection) => ({
      conceptId: asId<"MetadataConceptId">(selection.conceptId),
      kind: selection.kind,
      label: selection.label,
      polarity: selection.polarity,
    })),
    freeformNote,
  });
  return { ...result, freeformNote };
}
