import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260809170000_add_virtual_try_on_usage_ledger.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("virtual try-on usage ledger database security contract", () => {
  it("enables RLS and removes anonymous Data API access on both tables", () => {
    for (const table of [
      "retailer_virtual_try_on_policies",
      "virtual_try_on_usage_ledger",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toMatch(
        new RegExp(`revoke all on table public\\.${table} from anon`),
      );
    }
  });

  it("defaults retailer_virtual_try_on_policies to fail-closed", () => {
    expect(migration).toContain("enabled boolean not null default false");
    expect(migration).toContain(
      "monthly_budget_minor_units integer not null default 0",
    );
    expect(migration).toContain(
      "per_customer_monthly_budget_minor_units integer not null default 0",
    );
    expect(migration).toContain(
      "max_customer_generations_per_day integer not null default 0",
    );
    expect(migration).toContain(
      "max_customer_generations_per_week integer not null default 0",
    );
    expect(migration).toContain(
      "max_customer_generations_per_month integer not null default 0",
    );
  });

  it("seeds a default virtual try-on policy for every retailer", () => {
    expect(migration).toContain(
      "create or replace function public.ensure_default_retailer_virtual_try_on_policy()",
    );
    expect(migration).toContain("after insert on public.retailers");
    expect(migration).toContain(
      "execute function public.ensure_default_retailer_virtual_try_on_policy()",
    );
  });

  it("enforces check constraints on virtual_try_on_usage_ledger", () => {
    // settled_at check constraint: cache_hit is terminal, authorized waits for settlement
    expect(migration).toContain(
      "constraint virtual_try_on_usage_ledger_settled_chk check (",
    );
    expect(migration).toContain(
      "(status in ('succeeded', 'failed', 'cancelled', 'cache_hit')) = (settled_at is not null)",
    );
    // denied requires denial_reason
    expect(migration).toContain(
      "constraint virtual_try_on_usage_ledger_denied_chk check (",
    );
    expect(migration).toContain(
      "status <> 'denied' or denial_reason is not null",
    );
    // failed requires failure_code
    expect(migration).toContain(
      "constraint virtual_try_on_usage_ledger_failed_chk check (",
    );
    expect(migration).toContain(
      "status <> 'failed' or failure_code is not null",
    );
  });

  it("creates RLS policies with correct names and tenant isolation", () => {
    expect(migration).toContain(
      'create policy "customers read own virtual try-on usage"',
    );
    expect(migration).toContain(
      'create policy "retailer staff read tenant virtual try-on usage"',
    );
    expect(migration).toContain(
      'create policy "retailer managers write their own virtual try-on policy"',
    );
  });

  it("reserve_virtual_try_on_generation re-derives caller identity and checks module state", () => {
    expect(migration).toContain("if auth.uid() is null then");
    expect(migration).toContain(
      "public.retailer_module_access_state(p_retailer_id, 'wardrobe_styling')",
    );
    expect(migration).toContain("wardrobe_styling");
  });

  it("settle_virtual_try_on_generation is granted to service_role only", () => {
    expect(migration).toMatch(
      /grant execute on function public\.settle_virtual_try_on_generation\(\s*uuid, text, text, integer, integer, text, integer, text, text, integer,\s*text, text\s*\)\s*to service_role;/s,
    );
  });
});
