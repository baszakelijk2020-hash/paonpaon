import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260801000004_add_staff_recognition_acts.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("staff_recognition_acts database security contract", () => {
  it("enables RLS and removes anonymous Data API access", () => {
    expect(migration).toContain(
      "alter table public.staff_recognition_acts enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.staff_recognition_acts\s+from public, anon/,
    );
  });

  it("pins an act's author to the calling user so nobody can log on a colleague's behalf falsely", () => {
    expect(migration).toContain(
      "create policy staff_recognition_acts_author_insert",
    );
    expect(migration).toContain("m.id = authored_by_staff_id");
    expect(migration).toContain("m.user_id = (select auth.uid())");
  });

  it("restricts review to owner/manager/admin in both USING and WITH CHECK", () => {
    expect(migration).toContain(
      "create policy staff_recognition_acts_manager_review",
    );
    expect(
      (
        migration.match(
          /public\.current_retailer_role\(\) in \('owner', 'manager', 'admin'\)/g,
        ) ?? []
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("has no count, score, rank or points column — this item forbids a raw-volume leaderboard", () => {
    // Structural guard on PHASE 11.2's explicit non-goal: a leaderboard
    // cannot be rendered from this table without first adding a column,
    // which would fail this test and force the non-goal back into the
    // conversation.
    //
    // Checks the CREATE TABLE body specifically, not the whole file — the
    // trailing COMMENT ON deliberately uses the words "count", "score" and
    // "rank" to explain why they are absent, and a whole-file scan would
    // flag that explanation as the very thing it warns against.
    const createTableBody =
      /create table if not exists public\.staff_recognition_acts \(([\s\S]*?)\n\);/.exec(
        migration,
      )?.[1];
    expect(createTableBody).toBeTruthy();
    expect(createTableBody).not.toMatch(
      /\b(act_count|recognition_count|score|points|rank|leaderboard)\b/i,
    );
  });

  it("requires a reviewed act to name both its reviewer and timestamp", () => {
    expect(migration).toContain("staff_recognition_acts_review_complete");
    expect(migration).toContain(
      "(review_state = 'submitted')\n    = (reviewed_by_staff_id is null and reviewed_at is null)",
    );
  });

  it("requires a coaching state to carry an actual coaching note", () => {
    expect(migration).toContain("staff_recognition_acts_coaching_needs_note");
    expect(migration).toContain(
      "review_state <> 'coached' or coaching_note is not null",
    );
  });

  it("indexes the manager review queue it actually renders", () => {
    expect(migration).toContain("staff_recognition_acts_review_queue_idx");
    expect(migration).toContain("where review_state = 'submitted'");
  });
});
