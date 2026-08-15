/**
 * PHASE 18.5's own named gap: linking a corporate_wearers row to a real
 * customers row, without ever fabricating a shopper who did not choose to
 * be one (see docs/EMPLOYEE_PORTAL_SELF_SERVICE_BLUEPRINT.md sec3). Pure
 * presentation-state logic only — the actual linking/creation is two
 * `security definer` RPCs (see that document's sec5), not application-layer
 * logic re-derivable from a client call.
 */

export type WearerCustomerLinkState =
  | "linked" // corporate_wearers.customer_id is set
  | "eligible_to_link"; // not yet set — the opt-in CTA renders

export function wearerCustomerLinkState(params: {
  readonly customerId?: string;
}): WearerCustomerLinkState {
  return params.customerId ? "linked" : "eligible_to_link";
}
