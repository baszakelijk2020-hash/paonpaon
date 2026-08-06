import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260806110000_add_style_portrait_consent.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("style portrait consent database security contract", () => {
  it("enables RLS and removes anonymous Data API access", () => {
    expect(migration).toContain(
      "alter table public.style_portrait_consents enable row level security",
    );
    expect(migration).toContain(
      "revoke all on table public.style_portrait_consents from anon",
    );
  });

  it("requires disclosures acknowledged and a grant timestamp before status can be granted", () => {
    expect(migration).toContain("style_portrait_consents_granted_chk");
    expect(migration).toContain(
      "status <> 'granted' or (disclosures_acknowledged and granted_at is not null)",
    );
  });

  it("scopes consent to the owning customer, with a read-only advisor path", () => {
    expect(migration).toContain(
      'create policy "a customer can read their own style portrait consent"',
    );
    expect(migration).toContain(
      'create policy "retailer staff read tenant style portrait consent"',
    );
    expect(migration).toContain("c.user_id = (select auth.uid())");
    expect(migration).toContain(
      "retailer_id = (select public.current_retailer_id())",
    );
  });

  it("keeps this consent purpose independent of the shared CustomerConsentState/ConsentPurpose type", () => {
    // ADR-074: a fourth CONSENT_PURPOSES value would have widened a shared
    // interface every existing consent consumer would have had to update.
    // The design rationale names customer_consent_events in a comment; the
    // schema itself must never write into or reference it.
    expect(migration).not.toContain(
      "insert into public.customer_consent_events",
    );
    expect(migration).not.toContain(
      "references public.customer_consent_events",
    );
  });
});
