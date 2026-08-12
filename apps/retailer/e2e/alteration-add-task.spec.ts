import { createSupabaseAdminClient } from "@paon/database";
import { expect, test } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("owner adds a task to an existing alteration work order after intake", async ({
  page,
}) => {
  const unique = Date.now();

  await page.goto("/alterations/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Garment type").fill("Navy two-piece suit");
  await page
    .getByLabel("Description")
    .fill("Customer-owned suit, jacket and trousers.");
  await page
    .getByLabel("Intake condition")
    .fill("Good condition, dry cleaned.");
  await page.getByLabel("Observation area").fill("Waist");
  await page
    .getByLabel("Observation", { exact: true })
    .fill("Waistband is snug.");
  await page.getByLabel("Work-now task").fill("Let out waistband");
  await page.getByRole("button", { name: "Create work order" }).click();
  await expect(page).toHaveURL(/\/alterations\/[0-9a-f-]+$/);

  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(
    page.locator("p.font-medium", { hasText: "Let out waistband" }),
  ).toBeVisible();

  const newTaskTitle = `Reline jacket collar ${unique}`;
  await page.getByLabel("New task title").fill(newTaskTitle);
  await page
    .getByLabel("New task instructions")
    .fill("Collar lining has worn through, replace with matching fabric.");
  await page
    .getByLabel("New task origin note")
    .fill("Spotted during a follow-up group fitting.");
  await page.getByRole("button", { name: "Add task" }).click();

  await expect(
    page.getByText(
      "Task added. Price it via a pricing proposal to add it to the total.",
    ),
  ).toBeVisible();

  const newTaskCard = page
    .locator("div.px-6.py-4", { hasText: newTaskTitle })
    .first();
  await expect(
    newTaskCard.locator("p.font-medium", { hasText: newTaskTitle }),
  ).toBeVisible();
  await expect(
    newTaskCard.getByText(
      "Collar lining has worn through, replace with matching fabric.",
    ),
  ).toBeVisible();
  await expect(newTaskCard.getByText("Now · Proposed")).toBeVisible();
  await expect(newTaskCard.getByText("Original quote 0 USD")).toBeVisible();
});

test("owner records labour/material/partner cost allocation on a task", async ({
  page,
}) => {
  await page.goto("/alterations/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await page.getByLabel("Garment type").fill("Navy two-piece suit");
  await page
    .getByLabel("Description")
    .fill("Customer-owned suit, jacket and trousers.");
  await page
    .getByLabel("Intake condition")
    .fill("Good condition, dry cleaned.");
  await page.getByLabel("Observation area").fill("Waist");
  await page
    .getByLabel("Observation", { exact: true })
    .fill("Waistband is snug.");
  await page.getByLabel("Work-now task").fill("Let out waistband");
  await page.getByRole("button", { name: "Create work order" }).click();
  await expect(page).toHaveURL(/\/alterations\/[0-9a-f-]+$/);

  const taskCard = page
    .locator("div.px-6.py-4", { hasText: "Let out waistband" })
    .first();
  await taskCard.getByLabel("Let out waistband labour cost").fill("40");
  await taskCard.getByLabel("Let out waistband material cost").fill("15");
  await taskCard.getByLabel("Let out waistband partner cost").fill("0");
  await taskCard
    .getByLabel("Let out waistband cost allocation reason")
    .fill("Workshop invoice #4821");
  await taskCard
    .getByRole("button", { name: "Record cost allocation" })
    .click();

  await expect(
    taskCard.getByText(
      "Cost allocation — labour 40, material 15, partner 0 USD",
    ),
  ).toBeVisible();
});

test("owner's customer-visible status update threads a message into the Communication Centre", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  await page.goto("/alterations/new");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  const customerId = await page.getByLabel("Customer").inputValue();
  await page.getByLabel("Garment type").fill("Navy two-piece suit");
  await page
    .getByLabel("Description")
    .fill("Customer-owned suit, jacket and trousers.");
  await page
    .getByLabel("Intake condition")
    .fill("Good condition, dry cleaned.");
  await page.getByLabel("Observation area").fill("Waist");
  await page
    .getByLabel("Observation", { exact: true })
    .fill("Waistband is snug.");
  await page.getByLabel("Work-now task").fill("Let out waistband");
  await page.getByRole("button", { name: "Create work order" }).click();
  await expect(page).toHaveURL(/\/alterations\/[0-9a-f-]+$/);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");

  // A customer-visible transition from the existing update form should
  // thread a real message into the customer's Communication Centre
  // conversation and stamp alteration_work_orders.customer_notified_at --
  // neither of which happened before this slice.
  await page.getByLabel("Status", { exact: true }).selectOption("quoted");
  await page.getByLabel("Customer-visible update").check();
  await page
    .getByLabel("Note", { exact: true })
    .fill("Your quote is ready for review.");
  await page.getByRole("button", { name: "Add update" }).click();

  await expect(page.getByText("Your quote is ready for review.")).toBeVisible({
    timeout: 15_000,
  });

  await expect
    .poll(
      async () => {
        const { data: conversation } = await admin
          .from("conversations")
          .select("id")
          .eq("retailer_id", retailer.id)
          .eq("customer_id", customerId)
          .maybeSingle();
        if (!conversation) return null;
        const { data: messages } = await admin
          .from("messages")
          .select("body, sender_type")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(1);
        return messages?.[0]?.body ?? null;
      },
      { timeout: 20_000 },
    )
    .toContain("Your quote is ready for review.");

  const { data: workOrder } = await admin
    .from("alteration_work_orders")
    .select("customer_notified_at")
    .eq("retailer_id", retailer.id)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  expect(workOrder?.customer_notified_at).toBeTruthy();
});
