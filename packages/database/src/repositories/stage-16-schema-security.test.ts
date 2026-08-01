import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = fileURLToPath(
  new URL("../../../../supabase/migrations/", import.meta.url),
);
const migration = readFileSync(
  `${dir}20260801000014_add_knowledge_experience_wedding.sql`,
  "utf8",
);

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

describe("PHASE 16.1/16.2 knowledge and incubation", () => {
  it("cannot publish unreviewed machine-written content", () => {
    // The non-goal as a CHECK constraint rather than a review convention.
    expect(tableBody("knowledge_articles")).toContain(
      "constraint knowledge_ai_needs_human_approval",
    );
  });

  it("requires a provenance on every article", () => {
    // NOT NULL so an AI draft cannot be laundered in by omitting it.
    expect(tableBody("knowledge_articles")).toContain(
      "provenance text not null check (",
    );
  });

  it("requires a licence reference on third-party content", () => {
    expect(tableBody("knowledge_articles")).toContain(
      "constraint knowledge_licensed_needs_licence",
    );
  });

  it("refuses an author reviewing their own article", () => {
    expect(tableBody("knowledge_articles")).toContain(
      "constraint knowledge_reviewer_not_author",
    );
  });

  it("has nowhere to record a speculative stock purchase", () => {
    // "No speculative stock purchase" means no purchase order, committed
    // quantity or supplier order column exists to write one into.
    const body = tableBody("product_hypotheses");
    expect(body).not.toMatch(
      /\b(purchase_order|committed_quantity|supplier_order|ordered_units)\b/,
    );
    expect(body).toContain("constraint product_hypothesis_evidenced_needs_all");
  });

  it("keeps a roleplay grade evidenced and never self-awarded", () => {
    const body = tableBody("academy_roleplay_grades");
    expect(body).toContain("constraint academy_grade_has_evidence");
    expect(body).toContain("constraint academy_grade_self_grading");
    // Same non-goal as 11.2/11.3: no aggregate score per person.
    expect(body).not.toMatch(/\b(average|total_score|rank|points)\b/);
  });

  it("cannot close a consultancy project without the retailer's approval", () => {
    expect(tableBody("consultancy_projects")).toContain(
      "constraint consultancy_close_needs_approval",
    );
  });
});

describe("PHASE 16.4 store instrumentation", () => {
  it("cannot attribute an observation to a member of staff", () => {
    // A zone sensor that can report which advisor stood where becomes a
    // productivity monitor the day someone asks it to.
    const body = tableBody("store_observations");
    expect(body).not.toMatch(/\bstaff_id\b/);
  });

  it("holds no biometric template of any kind", () => {
    const body = tableBody("store_observations");
    expect(body).not.toMatch(
      /\b(face|facial|biometric|gait|embedding|template|descriptor)\b/i,
    );
  });

  it("records no customer identity on an anonymous observation", () => {
    expect(tableBody("store_observations")).not.toMatch(/\bcustomer_id\b/);
  });

  it("requires a customer-approved look before a session can close", () => {
    // Otherwise the store's own instrumentation becomes the record of what
    // the customer "wanted".
    expect(tableBody("store_sessions")).toContain(
      "constraint store_session_outcome_needs_look",
    );
  });

  it("treats a device failure with a fallback as a normal closed session", () => {
    expect(tableBody("store_sessions")).toContain(
      "constraint store_session_fallback_recorded",
    );
  });

  it("requires the reason behind a recorded preference", () => {
    expect(tableBody("store_comparison_records")).toContain(
      "constraint store_comparison_preference_has_reason",
    );
  });
});

describe("PHASE 16.5 Moonstruck wedding pack", () => {
  it("creates no second party or member table anywhere in the repository", () => {
    // The owner boundary says "never create a second party model". Scanned
    // across every migration, not just this one.
    const all = readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => stripSqlComments(readFileSync(`${dir}${name}`, "utf8")));
    const partyTables = all
      .flatMap((sql) => [
        ...sql.matchAll(
          /create table (?:if not exists )?public\.(\w*part(?:y|ies)\w*)/gi,
        ),
      ])
      .map((match) => match[1]!.toLowerCase());
    expect([...new Set(partyTables)].sort()).toEqual([
      "wedding_parties",
      "wedding_party_members",
    ]);
  });

  it("hangs every new wedding table off the existing party rows", () => {
    for (const table of [
      "wedding_inspiration_items",
      "wedding_design_choices",
      "wedding_group_fittings",
      "wedding_guest_vouchers",
      "wedding_aftercare_plans",
    ]) {
      expect(tableBody(table)).toContain(
        "references public.wedding_parties (id) on delete cascade",
      );
    }
  });

  it("references the existing member row rather than restating a member", () => {
    for (const table of ["wedding_design_choices", "wedding_aftercare_plans"]) {
      expect(tableBody(table)).toContain(
        "references public.wedding_party_members (id) on delete cascade",
      );
    }
  });

  it("keeps a guest a label, never a customer record", () => {
    // The couple shared those names to organise a wedding, not to populate
    // a CRM.
    const body = tableBody("wedding_guest_vouchers");
    expect(body).toContain("guest_label text not null");
    expect(body).not.toMatch(/\bcustomer_id\b/);
  });

  it("requires a guest voucher to be funded and to expire", () => {
    const body = tableBody("wedding_guest_vouchers");
    expect(body).toContain("funding_source text not null");
    expect(body).toContain("expires_on date not null");
  });

  it("keeps a coordinated design choice party-wide rather than per member", () => {
    expect(tableBody("wedding_design_choices")).toContain(
      "constraint wedding_coordinated_is_party_wide",
    );
  });
});

describe("PHASE 16 tenancy", () => {
  it("carries retailer_id and RLS on every new table", () => {
    for (const table of [
      "knowledge_articles",
      "guided_tiers",
      "consultancy_projects",
      "consultancy_deliverables",
      "academy_roleplay_grades",
      "product_hypotheses",
      "vertical_packs",
      "store_zones",
      "store_observations",
      "store_sessions",
      "store_comparison_records",
      "wedding_inspiration_items",
      "wedding_design_choices",
      "wedding_group_fittings",
      "wedding_guest_vouchers",
      "wedding_aftercare_plans",
    ]) {
      expect(tableBody(table)).toContain(
        "retailer_id uuid not null references public.retailers (id) on delete cascade",
      );
      expect(migration).toContain(`'${table}'`);
    }
    expect(migration).toContain("enable row level security");
  });
});
