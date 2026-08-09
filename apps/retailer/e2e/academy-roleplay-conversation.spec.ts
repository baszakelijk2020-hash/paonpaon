import { createSupabaseAdminClient } from "@paon/database";
import { DEMO_PASSWORD } from "@paon/database/demo-seed";
import { ensureProgrammeProofSeed } from "@paon/database/programme-proof-seed";
import { PROGRAMME_PROOF_PERSONAS } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "17.8-roleplay-conversation";
const BROWSER_PROOF_SPEC =
  "apps/retailer/e2e/academy-roleplay-conversation.spec.ts";

let proofPassed = false;

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/**
 * Proves the real AI roleplay conversation partner (PHASE 17.8 / ADV-108):
 * an advisor starts a practice session against a published persona, sends
 * a real line, and gets back a real persisted persona reply — driven by
 * the deterministic `MockCommunicationDraftProvider` (no `OPENAI_API_KEY`
 * in this sandbox, same posture every other AI-assisted surface here
 * already documents), reached through the exact same
 * `submitRoleplayMessage` Server Action / `submit_academy_roleplay_turn`
 * RPC path production traffic would use. Ending the session is proven
 * against the database directly.
 */
test("an advisor practices against an AI persona and the real transcript persists", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  await ensureProgrammeProofSeed({ supabaseUrl, anonKey, serviceRoleKey });
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  await signIn(page, PROGRAMME_PROOF_PERSONAS.advisor.email);
  await page.goto("/staff/learning");

  await page.selectOption("#roleplay-persona", "browser");
  await page.getByRole("button", { name: "Start practice" }).click();

  await expect(page.locator("#roleplay-active-session")).toBeVisible({
    timeout: 30_000,
  });

  const { data: staffRow } = await admin
    .from("retailer_staff_members")
    .select("id, retailer_id")
    .eq("email", PROGRAMME_PROOF_PERSONAS.advisor.email)
    .single();
  expect(staffRow).toBeTruthy();

  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("academy_roleplay_sessions")
          .select("id, status, persona_key")
          .eq("staff_id", staffRow!.id)
          .eq("status", "active")
          .maybeSingle();
        return data ?? null;
      },
      { timeout: 30_000 },
    )
    .toMatchObject({ status: "active", persona_key: "browser" });

  const advisorLine = "Welcome in! Anything I can help you find today?";
  await page.locator("#roleplay-advisor-text").fill(advisorLine);
  await page.getByRole("button", { name: "Send" }).click();

  await expect(
    page.locator('[data-speaker="advisor"]', { hasText: advisorLine }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-speaker="persona"]')).toBeVisible({
    timeout: 30_000,
  });

  const { data: session } = await admin
    .from("academy_roleplay_sessions")
    .select("id, status, turn_count")
    .eq("staff_id", staffRow!.id)
    .eq("status", "active")
    .single();
  expect(session).toMatchObject({ turn_count: 2 });

  const { data: messages } = await admin
    .from("academy_roleplay_messages")
    .select("turn_index, speaker, content")
    .eq("session_id", session!.id)
    .order("turn_index", { ascending: true });
  expect(messages).toHaveLength(2);
  expect(messages![0]).toMatchObject({ turn_index: 0, speaker: "advisor" });
  expect(messages![0]!.content).toBe(advisorLine);
  expect(messages![1]).toMatchObject({ turn_index: 1, speaker: "persona" });
  expect(messages![1]!.content.length).toBeGreaterThan(0);

  const { data: recordedGeneration } = await admin
    .from("ai_generations")
    .select("kind, status, provider")
    .eq("requested_by_staff_id", staffRow!.id)
    .eq("kind", "academy_roleplay")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  expect(recordedGeneration).toMatchObject({
    kind: "academy_roleplay",
    status: "succeeded",
    provider: "mock",
  });

  await page.getByRole("button", { name: "End session" }).click();
  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("academy_roleplay_sessions")
          .select("status")
          .eq("id", session!.id)
          .single();
        return data?.status ?? null;
      },
      { timeout: 30_000 },
    )
    .toBe("completed");

  // Grading integration: a manager can cite this exact real transcript
  // when grading, not just tag a persona label after the fact.
  await page.getByRole("button", { name: "Sign out" }).click({ force: true });
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto("/staff/learning");

  await page.selectOption("#grade-staff", staffRow!.id);
  await page.locator("#grade-lesson").fill("roleplay-conversation-review");
  await page.selectOption("#grade-roleplay-session", session!.id);
  await page.locator("#grade-criterion").fill("stayed-on-topic");
  await page
    .locator("#grade-evidence-ref")
    .fill("academy-roleplay-conversation-proof");
  await page
    .locator("#grade-observed")
    .fill("Reviewed the real recorded transcript before grading.");
  await page.getByRole("button", { name: "Record grade" }).click();

  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("academy_roleplay_grades")
          .select("id, roleplay_session_id")
          .eq("staff_id", staffRow!.id)
          .eq("lesson_key", "roleplay-conversation-review")
          .maybeSingle();
        return data ?? null;
      },
      { timeout: 30_000 },
    )
    .toMatchObject({ roleplay_session_id: session!.id });

  proofPassed = true;
});
