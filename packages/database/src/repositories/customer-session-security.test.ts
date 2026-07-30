import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730240000_add_customer_interaction_sessions.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("customer interaction session database security contract", () => {
  it("creates tenant-scoped sessions with RLS and no anonymous access", () => {
    expect(migration).toContain(
      "create table if not exists public.customer_interaction_sessions",
    );
    expect(migration).toContain(
      "alter table public.customer_interaction_sessions enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.customer_interaction_sessions from anon/,
    );
  });

  it("links behavioral events to sessions with retailer-scoped idempotency", () => {
    expect(migration).toContain("add column if not exists session_id uuid");
    expect(migration).toContain(
      "add column if not exists idempotency_key text",
    );
    expect(migration).toContain("behavioral_events_retailer_idempotency_uidx");
  });

  it("extends capture RPC with session/idempotency and sensitive-property denial", () => {
    expect(migration).toContain("p_session_id uuid default null");
    expect(migration).toContain("p_idempotency_key text default null");
    expect(migration).toContain("'tie_mate_impression'");
    expect(migration).toContain(
      "Event must not capture sensitive or durable business records",
    );
  });

  it("keeps anonymous persistence blocked while signed-in sessions remain buildable", () => {
    expect(migration).toContain(
      "Anonymous interaction persistence is not enabled for this jurisdiction",
    );
    expect(migration).toContain(
      "create or replace function public.start_customer_interaction_session",
    );
  });
});
