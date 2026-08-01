import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = fileURLToPath(
  new URL("../../../../supabase/migrations/", import.meta.url),
);
const production = readFileSync(
  `${dir}20260801000008_add_serialized_production.sql`,
  "utf8",
);
const partners = readFileSync(
  `${dir}20260801000009_add_service_partner_network.sql`,
  "utf8",
);
const supplier = readFileSync(
  `${dir}20260801000010_add_supplier_intelligence.sql`,
  "utf8",
);

function tableBody(migration: string, name: string): string {
  const start = migration.indexOf(
    `create table if not exists public.${name} (`,
  );
  expect(start).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf("\n);", start));
}

describe("PHASE 12.2 serialized production schema", () => {
  it("pins an immutable Stage 12.1 measurement version with RESTRICT", () => {
    // SET NULL would let the pointer vanish and make "what was this cut
    // to" unanswerable — the exact question the whole gate exists for.
    expect(tableBody(production, "production_specs")).toContain(
      "measurement_version_id uuid not null\n    references public.customer_measurement_versions (id) on delete restrict",
    );
  });

  it("keeps stage history and spec amendments append-only", () => {
    for (const table of [
      "production_stage_events",
      "production_spec_amendments",
    ]) {
      expect(production).toContain(
        `grant select, insert on table public.${table}\n  to authenticated, service_role;`,
      );
      expect(production).not.toMatch(
        new RegExp(`grant[^;]*\\bupdate\\b[^;]*on table public\\.${table}`),
      );
    }
  });

  it("requires a stated defect on every rework", () => {
    expect(tableBody(production, "production_stage_events")).toContain(
      "constraint production_rework_has_defect",
    );
  });

  it("refuses an inspector who is the person who recorded the work", () => {
    expect(tableBody(production, "production_stage_events")).toContain(
      "constraint production_inspector_not_maker",
    );
  });

  it("gives each piece its own barcode, unique within the retailer", () => {
    // "Jacket/trousers scan independently" needs the barcode to be a piece
    // identity, not an order identity.
    const body = tableBody(production, "production_pieces");
    expect(body).toContain(
      "constraint production_pieces_barcode_unique unique (retailer_id, barcode)",
    );
    expect(body).toContain(
      "constraint production_pieces_sequence_unique unique (order_id, piece_sequence)",
    );
  });

  it("requires an amendment to name a reason and who pays", () => {
    const body = tableBody(production, "production_spec_amendments");
    expect(body).toContain("reason text not null");
    expect(body).toContain("cost_decision text not null check (");
    expect(body).toContain(
      "cost_decision in ('retailer_absorbs', 'customer_pays', 'supplier_credit')",
    );
  });
});

describe("PHASE 12.3 partner network schema", () => {
  it("creates no second bookings, plans or cost table", () => {
    // The concierge tables from 2026-07-30 stay canonical.
    // Anchored on the CREATE TABLE target, not on any mention: a create
    // statement's body legitimately references those tables as foreign
    // keys, and a loose scan flags its own reuse as a duplication.
    expect(partners).not.toMatch(
      /create table (if not exists )?public\.(service_bookings|service_plans|service_cost_records)\s*\(/,
    );
    // And it does reference them, rather than ignoring them.
    expect(partners).toContain("references public.service_bookings (id)");
    expect(partners).toContain("references public.service_cost_records (id)");
  });

  it("keeps partner custody append-only", () => {
    // An editable custody log cannot settle a damage dispute.
    expect(partners).toContain(
      "grant insert on table public.service_partner_custody_events\n  to authenticated, service_role;",
    );
    expect(partners).not.toMatch(
      /grant[^;]*\bupdate\b[^;]*on table public\.service_partner_custody_events/,
    );
  });

  it("requires a condition note on the return leg", () => {
    expect(tableBody(partners, "service_partner_custody_events")).toContain(
      "constraint partner_custody_return_has_condition",
    );
  });

  it("records retailer and customer opinion separately", () => {
    // Collapsing them would let a retailer's assessment be reported as the
    // customer's.
    const body = tableBody(partners, "service_partner_quality_reviews");
    expect(body).toContain("retailer_rating smallint");
    expect(body).toContain("customer_rating smallint");
  });

  it("names no payout, provider or payment on a partner invoice", () => {
    // ADR-062 has not decided a payout design.
    const body = tableBody(partners, "service_partner_invoices");
    expect(body).not.toMatch(/payout|stripe|provider_reference|payment_id/i);
    expect(body).toContain("constraint partner_invoice_no_self_approval");
  });

  it("requires an engagement to be about a specific garment", () => {
    // "A bag of stuff" is how items go missing with nobody able to say
    // which.
    expect(tableBody(partners, "service_partner_engagements")).toContain(
      "constraint service_partner_engagement_has_garment",
    );
  });
});

describe("PHASE 12.4 supplier intelligence schema", () => {
  it("has no bare availability column anywhere — every fact names a source", () => {
    const body = tableBody(supplier, "supplier_facts");
    expect(body).toContain("source_authority_key text not null");
    expect(body).toContain("source_version text not null");
    expect(body).toContain("observed_at timestamptz not null");
  });

  it("keeps supplier facts append-only", () => {
    // An observation is a historical statement; editing one rewrites what
    // a supplier told us. A correction is a later observation.
    expect(supplier).toContain(
      "grant insert on table public.supplier_facts to authenticated, service_role;",
    );
    expect(supplier).not.toMatch(
      /grant[^;]*\bupdate\b[^;]*on table public\.supplier_facts/,
    );
  });

  it("refuses an uncited or unowned supply exception", () => {
    const body = tableBody(supplier, "supply_exceptions");
    expect(body).toContain("owner_staff_id uuid not null");
    expect(body).toContain("constraint supply_exceptions_cited");
  });

  it("refuses to close a complaint with no customer recovery recorded", () => {
    expect(tableBody(supplier, "supply_complaint_cases")).toContain(
      "constraint complaint_close_complete",
    );
  });

  it("creates no factory write-back queue", () => {
    // The non-goal is "no undocumented factory write-back". The honest
    // form of that is no queue at all, not an unused one.
    expect(supplier).not.toMatch(
      /create table[^;]*(factory_writeback|supplier_push|factory_submissions)/i,
    );
  });

  it("counts a repeated identical observation as one statement", () => {
    // Two rows with the same authority, fact and timestamp would read as
    // corroboration when it is the same statement recorded twice.
    expect(tableBody(supplier, "supplier_facts")).toContain(
      "constraint supplier_facts_unique",
    );
  });
});

describe("PHASE 12 tenancy", () => {
  it("carries retailer_id and enables RLS on every new table", () => {
    const all: readonly (readonly [string, readonly string[]])[] = [
      [
        production,
        [
          "production_specs",
          "production_spec_amendments",
          "production_pieces",
          "production_stage_events",
          "production_material_lines",
          "production_work_tickets",
        ],
      ],
      [
        partners,
        [
          "service_partners",
          "service_partner_engagements",
          "service_partner_custody_events",
          "service_partner_quality_reviews",
          "service_partner_invoices",
          "service_partner_invoice_lines",
        ],
      ],
      [
        supplier,
        [
          "supplier_facts",
          "fabric_button_rules",
          "supply_exceptions",
          "supply_complaint_cases",
        ],
      ],
    ];
    for (const [migration, tables] of all) {
      for (const table of tables) {
        expect(tableBody(migration, table)).toContain(
          "retailer_id uuid not null references public.retailers (id) on delete cascade",
        );
        expect(migration).toContain(
          `alter table public.${table} enable row level security;`,
        );
      }
    }
  });
});
