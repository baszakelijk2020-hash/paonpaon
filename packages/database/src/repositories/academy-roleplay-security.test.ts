import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260809190000_add_academy_roleplay_conversation.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("academy roleplay conversation database security contract", () => {
  it("enables RLS and removes anonymous Data API access on both tables", () => {
    for (const table of [
      "academy_roleplay_sessions",
      "academy_roleplay_messages",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toMatch(
        new RegExp(`revoke all on table public\\.${table} from anon`),
      );
    }
  });

  it("allows at most one active session per staff member", () => {
    expect(migration).toContain(
      "create unique index academy_roleplay_sessions_one_active_per_staff",
    );
    expect(migration).toContain("where status = 'active'");
  });

  it("restricts persona_key to the published six-persona catalog", () => {
    expect(migration).toContain(
      "persona_key in (\n      'first_time_buyer', 'browser', 'know_it_all', 'couple',\n      'complaint_handling', 'white_glove'\n    )",
    );
  });

  it("only grants table writes to service_role — client writes go through the RPCs", () => {
    for (const table of [
      "academy_roleplay_sessions",
      "academy_roleplay_messages",
    ]) {
      expect(migration).toContain(
        `grant select on table public.${table}\n  to authenticated, service_role`,
      );
      expect(migration).toContain(
        `grant all on table public.${table} to service_role`,
      );
    }
  });

  it("re-derives caller identity server-side in every RPC rather than trusting client-supplied ids", () => {
    expect(migration).toContain("if auth.uid() is null then");
    expect(migration).toContain(
      "raise exception 'Not an accepted staff member of this retailer'",
    );
    expect(migration).toContain(
      "raise exception 'Session not found or not owned by the caller'",
    );
    expect(migration).toContain(
      "raise exception 'Session not found, not owned by the caller, or already ended'",
    );
  });

  it("always inserts the advisor turn and the persona reply together, in order", () => {
    expect(migration).toContain(
      "(p_session_id, v_next_turn, 'advisor', p_advisor_text),\n    (p_session_id, v_next_turn + 1, 'persona', p_persona_text);",
    );
  });

  it("revokes public execute on every RPC and grants only to authenticated", () => {
    for (const fn of [
      "start_academy_roleplay_session(uuid, text)",
      "submit_academy_roleplay_turn(uuid, text, text)",
      "end_academy_roleplay_session(uuid, text)",
    ]) {
      expect(migration).toContain(
        `revoke all on function public.${fn} from public`,
      );
      expect(migration).toContain(`grant execute on function public.${fn}`);
    }
  });

  it("enforces same-tenant linkage between a grade and the roleplay session it reviewed", () => {
    expect(migration).toContain(
      "create trigger academy_roleplay_grade_session_tenant_chk",
    );
    expect(migration).toContain(
      "raise exception 'roleplay_session_id must belong to the same retailer as the grade'",
    );
  });

  it("registers academy_roleplay as an AI generation kind", () => {
    expect(migration).toContain(
      "alter type public.ai_generation_kind add value if not exists 'academy_roleplay'",
    );
  });
});
