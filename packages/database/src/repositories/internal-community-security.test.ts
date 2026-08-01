import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationsDir = fileURLToPath(
  new URL("../../../../supabase/migrations/", import.meta.url),
);
const migration = readFileSync(
  `${migrationsDir}20260801000006_add_internal_community.sql`,
  "utf8",
);

function tableBody(name: string): string {
  const start = migration.indexOf(
    `create table if not exists public.${name} (`,
  );
  expect(start).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf("\n);", start));
}

describe("PHASE 11.4 schema security contract", () => {
  it("enables RLS and revokes anon on every new table", () => {
    for (const table of [
      "staff_announcements",
      "staff_announcement_acknowledgements",
      "staff_learning_contributions",
      "staff_learning_sessions",
      "service_recovery_budget_requests",
      "staff_support_resources",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(migration).toContain(
        `revoke all on table public.${table} from public, anon;`,
      );
      expect(tableBody(table)).toContain(
        "retailer_id uuid not null references public.retailers (id) on delete cascade",
      );
    }
  });

  it("records no support-resource usage anywhere in the schema", () => {
    // The load-bearing assertion of this item. A confidential handoff that
    // leaves an audit trail is not confidential, so the guarantee has to be
    // "no such table exists", checked across EVERY migration rather than
    // just this one — otherwise a later migration could quietly add it.
    const allMigrations = readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => readFileSync(`${migrationsDir}${name}`, "utf8"))
      .join("\n");
    expect(allMigrations).not.toMatch(
      /create table[^;]*support_resource_(views?|events?|access|usage)/i,
    );
    // And no counter smuggled onto the catalogue row itself.
    expect(tableBody("staff_support_resources")).not.toMatch(
      /\b(view_count|access_count|last_viewed_at|used_by)\b/,
    );
  });

  it("names no payment provider and moves no money for a budget request", () => {
    // ADR-062 has not decided a payout design; this is an internal
    // authorisation to spend, not a payment.
    const body = tableBody("service_recovery_budget_requests");
    expect(body).not.toMatch(/stripe|provider_reference|payment_id|payout/i);
    expect(body).toContain(
      "amount_minor_units integer not null check (amount_minor_units > 0)",
    );
  });

  it("refuses self-approval and self-moderation in the schema", () => {
    expect(tableBody("service_recovery_budget_requests")).toContain(
      "constraint service_recovery_no_self_approval",
    );
    expect(tableBody("staff_learning_contributions")).toContain(
      "constraint staff_learning_no_self_moderation",
    );
  });

  it("requires a budget request to be attached to a customer or an order", () => {
    expect(tableBody("service_recovery_budget_requests")).toContain(
      "constraint service_recovery_has_context check (\n    customer_id is not null or order_id is not null\n  )",
    );
  });

  it("requires a rejection to carry a reason", () => {
    expect(tableBody("staff_learning_contributions")).toContain(
      "constraint staff_learning_rejection_has_reason",
    );
  });

  it("lets a staff member record only their own read receipt", () => {
    const start = migration.indexOf(
      "create policy staff_announcement_ack_self_insert",
    );
    expect(start).toBeGreaterThan(-1);
    expect(migration.slice(start, migration.indexOf(";", start))).toContain(
      "m.user_id = (select auth.uid())",
    );
  });

  it("hides unapproved contributions from the general floor", () => {
    const start = migration.indexOf(
      "create policy staff_learning_visible_select",
    );
    const body = migration.slice(start, migration.indexOf(";", start));
    expect(body).toContain("state = 'approved'");
    expect(body).toContain(
      "public.current_retailer_role() in ('owner', 'manager', 'admin')",
    );
  });

  it("keeps budget requests out of general team visibility", () => {
    // They name a customer and an amount.
    expect(migration).toContain(
      "create policy service_recovery_requester_or_manager_select",
    );
    expect(migration).not.toContain(
      "create policy service_recovery_retailer_select",
    );
  });

  it("makes the support catalogue read-only to every session", () => {
    // SELECT to authenticated is intended — everyone must be able to find
    // help. What must not exist is a write grant to a session role: the
    // catalogue is curated, and a staff member editing a crisis phone
    // number is a failure mode with real consequences.
    expect(migration).toContain(
      "grant insert, update on table public.staff_support_resources\n  to service_role;",
    );
    expect(migration).not.toMatch(
      /grant[^;]*\b(insert|update|delete)\b[^;]*on table public\.staff_support_resources[^;]*\bauthenticated\b/,
    );
  });
});
