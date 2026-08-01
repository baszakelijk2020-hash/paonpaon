import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260801000011_add_stock_ledger_and_pos.sql",
    import.meta.url,
  ),
  "utf8",
);

/**
 * SQL comments stripped, line structure preserved. A guard that scans for
 * a forbidden identifier will otherwise match the comment explaining why
 * that identifier is absent — a mistake made repeatedly on this branch.
 */
function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
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

const migrationCode = stripSqlComments(migration);

const APPEND_ONLY = [
  "stock_ledger_entries",
  "rfid_sweep_observations",
  "pos_payments",
];

describe("PHASE 13.1 stock ledger", () => {
  it("has no balance column anywhere — a balance is a projection", () => {
    // The whole "no silent balance edits" guarantee rests on there being
    // nothing to edit.
    expect(migrationCode).not.toMatch(
      /\b(on_hand|onhand|quantity_on_hand|current_balance|stock_level)\b/,
    );
  });

  it("grants no UPDATE or DELETE on the ledger to any role", () => {
    expect(migration).toContain(
      "grant insert on table public.stock_ledger_entries to authenticated, service_role;",
    );
    for (const verb of ["update", "delete"]) {
      expect(migration).not.toMatch(
        new RegExp(
          `grant[^;]*\\b${verb}\\b[^;]*on table public\\.stock_ledger_entries`,
        ),
      );
    }
    expect(migration).not.toMatch(
      /create policy[^;]*stock_ledger_entries[^;]*for (update|delete)/,
    );
  });

  it("derives a reversal from the entry it cites", () => {
    expect(tableBody("stock_ledger_entries")).toContain(
      "constraint stock_ledger_reversal_cites_entry check (\n    (kind = 'reversal') = (reverses_entry_id is not null)\n  )",
    );
  });

  it("requires a count session and a reason on every adjustment", () => {
    expect(tableBody("stock_ledger_entries")).toContain(
      "constraint stock_ledger_adjustment_is_reasoned",
    );
  });

  it("dedupes a replayed event by idempotency key", () => {
    expect(tableBody("stock_ledger_entries")).toContain(
      "constraint stock_ledger_idempotency_unique\n    unique (retailer_id, idempotency_key)",
    );
  });

  it("stores one count line per variant per session", () => {
    // A second scan is a correction, not a doubling.
    expect(tableBody("stock_count_lines")).toContain(
      "constraint stock_count_line_unique unique (session_id, variant_id)",
    );
  });

  it("records whether a count was blind", () => {
    // A variance from a non-blind count is not as meaningful, and the
    // reader needs to be able to tell.
    expect(tableBody("stock_count_sessions")).toContain(
      "blind boolean not null default true",
    );
  });
});

describe("PHASE 13.2 loss prevention", () => {
  it("gives RFID observations no route into the ledger", () => {
    // A sweep never posts a balance.
    expect(tableBody("rfid_sweep_observations")).not.toContain(
      "stock_ledger_entries",
    );
    expect(migration).toContain(
      "grant insert on table public.rfid_sweep_observations to authenticated, service_role;",
    );
  });

  it("calls an unseen tag unobserved rather than missing", () => {
    const body = tableBody("rfid_sweep_discrepancies");
    expect(body).toContain("kind in ('unobserved', 'unexpected')");
    expect(body).not.toMatch(/\bmissing\b/);
  });

  it("refuses a resolution with no explanation", () => {
    expect(tableBody("rfid_sweep_discrepancies")).toContain(
      "constraint rfid_discrepancy_resolution_explained",
    );
  });

  it("requires a different person AND a manager to approve a risk flag", () => {
    expect(tableBody("stock_risk_flags")).toContain(
      "constraint stock_risk_no_self_approval",
    );
    expect(migration).toContain(
      "create policy stock_risk_flags_manager_update",
    );
  });

  it("carries no per-employee risk score column", () => {
    // The non-goal is explicit: no employee accusation score. A flag names
    // who requested the adjustment, for audit, but there is nothing that
    // accumulates against a person.
    const body = tableBody("stock_risk_flags");
    expect(body).not.toMatch(
      /\b(risk_score|suspicion|incident_count|staff_score)\b/,
    );
  });
});

describe("PHASE 13.3 POS", () => {
  it("has no column a card number could be written into", () => {
    const body = tableBody("pos_payments");
    expect(body).not.toMatch(
      /\b(pan|card_number|cardnumber|cvc|cvv|track2)\b/i,
    );
    expect(body).toContain("provider_reference text not null");
  });

  it("keeps payments append-only so a retry reconciles instead of duplicating", () => {
    expect(migration).toContain(
      "grant insert on table public.pos_payments to authenticated, service_role;",
    );
    expect(tableBody("pos_payments")).toContain(
      "constraint pos_payment_reference_unique",
    );
  });

  it("models a return as a new linked transaction, never an edit", () => {
    const body = tableBody("pos_transactions");
    expect(body).toContain(
      "returns_transaction_id uuid references public.pos_transactions (id) on delete restrict",
    );
    expect(body).toContain("constraint pos_return_not_self");
  });

  it("requires a reason to void and a timestamp to complete", () => {
    const body = tableBody("pos_transactions");
    expect(body).toContain("constraint pos_void_has_reason");
    expect(body).toContain("constraint pos_completed_has_time");
  });

  it("only lets an RTW line carry stock", () => {
    // A service or an MTM commission is not a shelf item.
    expect(tableBody("pos_transaction_lines")).toContain(
      "constraint pos_line_rtw_has_variant",
    );
  });

  it("cannot return more than was sold", () => {
    expect(tableBody("pos_transaction_lines")).toContain(
      "constraint pos_line_return_within_sold",
    );
  });
});

describe("PHASE 13 tenancy", () => {
  it("carries retailer_id, RLS and an anon revoke on every table", () => {
    for (const table of [
      "stock_locations",
      "stock_count_sessions",
      "stock_count_lines",
      "stock_ledger_entries",
      "stock_risk_flags",
      "rfid_sweep_observations",
      "rfid_sweep_discrepancies",
      "pos_transactions",
      "pos_transaction_lines",
      "pos_payments",
    ]) {
      expect(tableBody(table)).toContain(
        "retailer_id uuid not null references public.retailers (id) on delete cascade",
      );
    }
    // RLS and revokes are applied in a DO loop over the same list.
    for (const table of APPEND_ONLY) {
      expect(migration).toContain(`'${table}'`);
    }
    expect(migration).toContain("enable row level security");
    expect(migration).toContain(
      "revoke all on table public.%I from public, anon",
    );
  });
});
