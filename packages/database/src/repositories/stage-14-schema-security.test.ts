import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260801000012_add_corporate_and_cited_intelligence.sql",
    import.meta.url,
  ),
  "utf8",
);

/**
 * Strips both `--` comments AND `comment on ... is '...'` statements. The
 * second one caught this file out: a COMMENT ON is executable SQL, not a
 * lexical comment, so a naive strip left the sentence "never a reason or a
 * diagnosis" in the text and the no-health-column guard matched its own
 * explanation. Sixth occurrence of this failure mode on this branch.
 */
function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "").replace(/comment on [\s\S]*?;/g, "");
}

function tableBody(name: string): string {
  const start = migration.indexOf(
    `create table if not exists public.${name} (`,
  );
  expect(start).toBeGreaterThan(-1);
  return stripSqlComments(
    migration.slice(start, migration.indexOf("\n);", start)),
  );
}

describe("PHASE 14.1 corporate schema", () => {
  it("is not an HR system", () => {
    // No salary, manager hierarchy, termination reason or notice period.
    // A leaver is an entitlement event that produces garment returns.
    const body = tableBody("corporate_wearers");
    expect(body).not.toMatch(
      /\b(salary|compensation|manager_id|reports_to|termination|dismissal|notice_period|performance)\b/i,
    );
  });

  it("holds no health, diagnosis or accommodation-reason column", () => {
    const wearers = tableBody("corporate_wearers");
    expect(wearers).toContain("garment_adaptation_note");
    expect(wearers).not.toMatch(
      /\b(diagnosis|medical|health|disability|condition_note|accommodation_reason)\b/i,
    );
    // And nowhere else in the migration either.
    expect(stripSqlComments(migration)).not.toMatch(
      /\b(diagnosis|medical_note|health_data)\b/i,
    );
  });

  it("keeps entitlement versions and issue records append-only", () => {
    // An issue that can be edited is an entitlement balance that can be
    // quietly restated.
    for (const table of [
      "corporate_entitlement_versions",
      "corporate_issue_records",
    ]) {
      expect(migration).toContain(
        `grant insert on table public.${table}\n  to authenticated, service_role;`,
      );
      expect(migration).not.toMatch(
        new RegExp(`grant[^;]*\\bupdate\\b[^;]*on table public\\.${table}`),
      );
    }
  });

  it("pins an issue to the entitlement version it was drawn against", () => {
    expect(tableBody("corporate_issue_records")).toContain(
      "entitlement_version_id uuid not null\n    references public.corporate_entitlement_versions (id) on delete restrict",
    );
  });

  it("lets a wearer exist without a shadow customer record", () => {
    // Forcing one would create a customer per employee.
    expect(tableBody("corporate_wearers")).toContain(
      "customer_id uuid references public.customers (id) on delete set null",
    );
  });

  it("refuses an entitlement version with no rules", () => {
    expect(tableBody("corporate_entitlement_versions")).toContain(
      "constraint corporate_entitlement_rules_non_empty",
    );
  });
});

describe("PHASE 14.2 cited recommendations", () => {
  it("cannot store an uncited recommendation", () => {
    // "No black-box owner dashboard" as a CHECK constraint.
    expect(tableBody("cited_recommendations")).toContain(
      "constraint cited_recommendation_has_sources check (\n    jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) > 0\n  )",
    );
  });

  it("requires a positive sample size and an ordered window", () => {
    const body = tableBody("cited_recommendations");
    expect(body).toContain(
      "sample_size integer not null check (sample_size > 0)",
    );
    expect(body).toContain("constraint cited_recommendation_window_ordered");
  });

  it("records confidence as a band, never a percentage column", () => {
    const body = tableBody("cited_recommendations");
    expect(body).toContain(
      "confidence in ('insufficient_sample', 'indicative', 'supported')",
    );
    expect(body).not.toMatch(/confidence_percent|confidence_score/);
  });

  it("keeps the fact ids a correction needs to find what to recompute", () => {
    expect(tableBody("cited_recommendations")).toContain(
      "derived_from_fact_ids text[] not null default '{}'",
    );
  });

  it("requires a reason when a recommendation is withdrawn", () => {
    expect(tableBody("cited_recommendations")).toContain(
      "constraint cited_recommendation_withdrawal_explained",
    );
  });
});

describe("PHASE 14 tenancy", () => {
  it("carries retailer_id on every new table", () => {
    for (const table of [
      "corporate_accounts",
      "corporate_programmes",
      "corporate_entitlement_versions",
      "corporate_wearers",
      "corporate_issue_records",
      "corporate_exceptions",
      "cited_recommendations",
    ]) {
      expect(tableBody(table)).toContain(
        "retailer_id uuid not null references public.retailers (id) on delete cascade",
      );
      expect(migration).toContain(`'${table}'`);
    }
    expect(migration).toContain("enable row level security");
  });
});
