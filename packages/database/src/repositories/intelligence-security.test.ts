import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const consentMigration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260731100000_create_intelligence_consent_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);

const eventsMigration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260731110000_upgrade_behavioral_events_consent.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("intelligence consent database security contract", () => {
  it("enables RLS and removes anonymous Data API access on consent records", () => {
    expect(consentMigration).toContain(
      "alter table public.customer_consent_records enable row level security",
    );
    expect(consentMigration).toMatch(
      /revoke all on table[\s\S]*public\.customer_consent_records[\s\S]*from anon/,
    );
  });

  it("limits customer consent writes to the owning customer relationship", () => {
    expect(consentMigration).toContain("customers upsert their consent records");
    expect(consentMigration).toContain("c.user_id = auth.uid()");
    expect(consentMigration).toContain(
      "c.retailer_id = customer_consent_records.retailer_id",
    );
  });

  it("allows retailer staff to read consent for clienteling", () => {
    expect(consentMigration).toContain(
      "(select public.current_retailer_role()) in ('manager', 'admin', 'owner', 'sales_associate')",
    );
  });
});

describe("interaction event upgrade security contract", () => {
  it("requires consent snapshot columns and fail-closed capture", () => {
    expect(eventsMigration).toContain("consent_snapshot jsonb");
    expect(eventsMigration).toContain("retention_class public.retention_class");
    expect(eventsMigration).toContain(
      "raise exception 'Personalization consent required'",
    );
  });

  it("denies retroactive anonymous-to-customer linking at capture", () => {
    expect(eventsMigration).toContain(
      "Anonymous session events cannot include customer_id",
    );
  });

  it("provides service-role anonymization without client grants", () => {
    expect(eventsMigration).toContain(
      "anonymize_expired_interaction_events",
    );
    expect(eventsMigration).toContain("to service_role");
    expect(eventsMigration).not.toMatch(
      /grant execute on function public\.anonymize_expired_interaction_events[\s\S]*authenticated/,
    );
  });
});
