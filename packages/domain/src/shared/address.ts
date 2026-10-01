export type AddressLabel = "home" | "work" | "other";

export interface Address {
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly region?: string;
  readonly postalCode: string;
  readonly countryCode: string;
  /** Which named address this is on a profile with several (home/work/
   * other). Absent on the single-entry "1-Tap Checkout" default address —
   * that flow predates labeling and still collapses to one unlabeled
   * entry. */
  readonly label?: AddressLabel;
  /** Floor/unit — flagged separately from `line2` because delivery staff
   * read it differently (which door vs. which floor once inside). */
  readonly floor?: string;
  /** Reception/concierge/pickup instructions for couriers, e.g. "Leave with
   * reception, ask for Bas" — distinct from the address itself. */
  readonly deliveryNotes?: string;
}
