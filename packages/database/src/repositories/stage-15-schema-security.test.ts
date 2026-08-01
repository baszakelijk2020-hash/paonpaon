import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260801000013_add_network_merchant_audience.sql",
    import.meta.url,
  ),
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

const MERCHANT_TABLES = [
  "merchant_suppliers",
  "merchant_listings",
  "merchant_rfqs",
  "merchant_purchase_orders",
  "merchant_shipments",
  "merchant_shipment_issues",
  "merchant_group_buys",
];

describe("PHASE 15.1/15.2 partner network", () => {
  it("gives partner-facing events no customer column to join to", () => {
    // Not a nullable customer_id — none at all. A partner-facing query
    // must have nothing to resolve a person from.
    const body = tableBody("network_attribution_events");
    expect(body).toContain("pseudonymous_ref text not null");
    expect(body).not.toMatch(/\bcustomer_id\b/);
  });

  it("keeps the pseudonym map readable by service_role alone", () => {
    // The one table that could re-identify someone.
    expect(migration).toContain(
      "grant select, insert on table public.network_pseudonym_map to service_role;",
    );
    expect(migration).not.toMatch(
      /grant[^;]*on table public\.network_pseudonym_map[^;]*\bauthenticated\b/,
    );
    expect(migration).not.toContain(
      "create policy network_pseudonym_map_retailer_select",
    );
  });

  it("replays a retried provider callback idempotently", () => {
    expect(tableBody("network_attribution_events")).toContain(
      "constraint network_attribution_idempotent",
    );
  });

  it("requires a funding source and an expiry on every reward", () => {
    // Every unit of value traces to money that exists; an unexpiring
    // balance is an indefinite liability.
    const body = tableBody("network_reward_entries");
    expect(body).toContain("funding_source text not null");
    expect(body).toContain("expires_on date not null");
  });

  it("names no payout, provider or payment anywhere", () => {
    // ADR-062 has decided none of it.
    expect(stripSqlComments(migration)).not.toMatch(
      /\b(payout|stripe|provider_reference|payment_id)\b/i,
    );
  });

  it("requires a partner listing to carry a disclosure", () => {
    // A placement the customer cannot tell is commercial is an
    // advertisement pretending to be advice.
    expect(tableBody("network_partners")).toContain(
      "disclosure_text text not null",
    );
  });
});

describe("PHASE 15.3 MunroMerchant bounded context", () => {
  it("references nothing on the consumer side", () => {
    // "No customer-facing marketplace order reuse". A foreign key is the
    // only thing that could break the boundary, so the test looks for one.
    for (const table of MERCHANT_TABLES) {
      const body = tableBody(table);
      expect(body).not.toMatch(
        /references public\.(customers|orders|order_lines|wardrobe_items|products|product_variants)\b/,
      );
    }
  });

  it("refuses a self-approved purchase order", () => {
    expect(tableBody("merchant_purchase_orders")).toContain(
      "constraint merchant_po_no_self_approval",
    );
  });

  it("requires evidence on a damage or specification claim", () => {
    expect(tableBody("merchant_shipment_issues")).toContain(
      "constraint merchant_issue_has_evidence",
    );
  });

  it("requires a price before a quote can be accepted", () => {
    expect(tableBody("merchant_rfqs")).toContain(
      "constraint merchant_rfq_quote_has_price",
    );
  });

  it("refuses a listing with no price tiers", () => {
    expect(tableBody("merchant_listings")).toContain(
      "constraint merchant_tiers_non_empty",
    );
  });
});

describe("PHASE 15.4 advertising", () => {
  it("pins an order to a cohort version with RESTRICT", () => {
    // A later rule edit must not be able to restate a past forecast or a
    // past payable.
    expect(tableBody("advertising_orders")).toContain(
      "cohort_version_id uuid not null\n    references public.audience_cohort_versions (id) on delete restrict",
    );
    expect(tableBody("audience_forecasts")).toContain(
      "cohort_version_id uuid not null\n    references public.audience_cohort_versions (id) on delete restrict",
    );
  });

  it("cannot go live without a serving contract", () => {
    expect(tableBody("advertising_orders")).toContain(
      "constraint advertising_live_needs_contract",
    );
  });

  it("dedupes provider events", () => {
    expect(tableBody("advertising_events")).toContain(
      "constraint advertising_event_dedupe",
    );
  });

  it("carries no customer column on advertising events either", () => {
    expect(tableBody("advertising_events")).not.toMatch(/\bcustomer_id\b/);
  });

  it("versions a cohort rather than mutating it", () => {
    expect(tableBody("audience_cohort_versions")).toContain(
      "constraint audience_cohort_version_unique unique (retailer_id, cohort_key, version)",
    );
  });
});

describe("PHASE 15.5 governed release", () => {
  it("cannot record a release without purpose and entitlement", () => {
    // The acceptance criterion is that a release happens only with
    // purpose, contract and entitlement recorded. A nullable column would
    // make "recorded" optional.
    const body = tableBody("governed_releases");
    expect(body).toContain("purpose text not null");
    expect(body).toContain("entitlement_ref text not null");
  });

  it("enforces minimum-n as a CHECK, not as application logic", () => {
    expect(tableBody("governed_releases")).toContain(
      "constraint governed_release_meets_minimum_n",
    );
  });

  it("requires a customer request for a named introduction", () => {
    expect(tableBody("governed_releases")).toContain(
      "constraint governed_release_named_needs_request",
    );
  });

  it("requires a contract for clean-room, exchange and executed audiences", () => {
    expect(tableBody("governed_releases")).toContain(
      "constraint governed_release_contract_when_required",
    );
  });

  it("reverses a revenue share with a new row citing the original", () => {
    const body = tableBody("revenue_share_entries");
    expect(body).toContain(
      "reverses_entry_id uuid\n    references public.revenue_share_entries (id) on delete restrict",
    );
    expect(migration).toContain(
      "grant insert on table public.revenue_share_entries to authenticated, service_role;",
    );
    expect(migration).not.toMatch(
      /grant[^;]*\bupdate\b[^;]*on table public\.revenue_share_entries/,
    );
  });
});

describe("PHASE 15 tenancy", () => {
  it("carries retailer_id and RLS on every new table", () => {
    for (const table of [
      "network_partners",
      "network_listings",
      "network_pseudonym_map",
      "network_attribution_events",
      "network_reward_entries",
      ...MERCHANT_TABLES,
      "audience_cohort_versions",
      "audience_forecasts",
      "advertising_orders",
      "advertising_creatives",
      "advertising_events",
      "governed_releases",
      "revenue_share_entries",
    ]) {
      expect(tableBody(table)).toContain(
        "retailer_id uuid not null references public.retailers (id) on delete cascade",
      );
      expect(migration).toContain(`'${table}'`);
    }
  });
});
