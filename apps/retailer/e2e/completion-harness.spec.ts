import { createSupabaseAdminClient } from "@paon/database";
import { DEMO_PASSWORD } from "@paon/database/demo-seed";
import {
  ensureProgrammeProofSeed,
  workerCannotReadClientelingNote,
} from "@paon/database/programme-proof-seed";
import {
  PROGRAMME_PROOF_MARKERS,
  PROGRAMME_PROOF_PERSONAS,
} from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "8.4";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/completion-harness.spec.ts";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

let harnessPassed = false;

test.beforeAll(async () => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Completion harness requires local Supabase env (URL, anon, service role).",
    );
  }
  await ensureProgrammeProofSeed({ supabaseUrl, anonKey, serviceRoleKey });
});

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: harnessPassed ? "passed" : "failed",
  });
});

test("advisor mutates note → manager receives → worker RLS denied → DB asserts", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const proof = await ensureProgrammeProofSeed({
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  });

  const marker = `PAON-PROOF-8.4 ${Date.now()}`;

  await signIn(page, PROGRAMME_PROOF_PERSONAS.advisor.email);
  await page.goto(`/customers/${proof.customerId}`);
  await expect(
    page.getByRole("heading", {
      name: PROGRAMME_PROOF_PERSONAS.customer.displayName,
    }),
  ).toBeVisible();
  await page.locator("#clienteling-notes textarea[name='body']").fill(marker);
  await page.getByRole("button", { name: "Add private note" }).click();
  await expect(page.getByText(marker, { exact: true })).toBeVisible();

  await signOut(page);
  await signIn(page, PROGRAMME_PROOF_PERSONAS.manager.email);
  await page.goto(`/customers/${proof.customerId}`);
  await expect(page.getByText(marker, { exact: true })).toBeVisible();
  await expect(
    page.getByText(PROGRAMME_PROOF_MARKERS.pinnedNoteFragment, {
      exact: false,
    }),
  ).toBeVisible();

  await signOut(page);
  await signIn(page, PROGRAMME_PROOF_PERSONAS.worker.email);
  await page.goto(`/customers/${proof.customerId}`);
  await expect(page.getByText(marker, { exact: true })).toHaveCount(0);

  expect(
    await workerCannotReadClientelingNote({
      supabaseUrl,
      anonKey,
      workerEmail: PROGRAMME_PROOF_PERSONAS.worker.email,
      workerPassword: DEMO_PASSWORD,
      customerId: proof.customerId,
      noteBody: marker,
    }),
  ).toBe(true);

  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const { data: adminNotes, error: adminError } = await admin
    .from("clienteling_notes")
    .select("id, body")
    .eq("customer_id", proof.customerId)
    .eq("body", marker);
  expect(adminError).toBeNull();
  expect(adminNotes?.length).toBe(1);
  expect(adminNotes?.[0]?.body).toBe(marker);
  harnessPassed = true;
});
