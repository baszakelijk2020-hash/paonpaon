import { createSupabaseAdminClient } from "@paon/database";
import { seedDemoData } from "@paon/database/demo-seed";
import { expect, test } from "@playwright/test";

/**
 * Phase 20.24 — constrained-network prefetch proof.
 *
 * Proves `IntentPrefetchLink` guard blocks automatic eager prefetch when on a
 * constrained connection (saveData=true or effectiveType matching 2g/slow-2g),
 * but still allows user-intent-triggered prefetch (hover/focus/touch) even when
 * constrained, and performs eager prefetch on unconstrained connections.
 */

const DEMO_EMAIL = "contact+isabelle@nebelspiegel.com";

test("constrained connection blocks automatic eager prefetch on mount", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Test requires local Supabase variables.");
  }

  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  // Authenticate as demo customer
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: DEMO_EMAIL,
  });
  if (error || !link.properties) {
    throw error ?? new Error("magic link missing");
  }

  // Stub navigator.connection as constrained (saveData: true)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      value: {
        saveData: true,
        effectiveType: "4g",
      },
      writable: false,
    });
  });

  // Sign in
  await page.goto(
    `/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);

  // Navigate to dashboard with sidebar (where IntentPrefetchLink components render)
  await page.goto("/dashboard");
  await expect(page.locator("[data-customer-shell]")).toBeVisible();

  // Wait past the 200ms fallback timeout with margin to ensure no automatic prefetch fired
  await page.waitForTimeout(400);

  // Assert NO prefetch link was auto-appended for the sidebar Home link href
  const prefetchLinks = await page
    .locator('link[rel="prefetch"][as="document"][href="/r/atelier-demo"]')
    .count();
  expect(prefetchLinks).toBe(0);
});

test("unconstrained connection performs automatic eager prefetch on mount", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Test requires local Supabase variables.");
  }

  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  // Authenticate as demo customer
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: DEMO_EMAIL,
  });
  if (error || !link.properties) {
    throw error ?? new Error("magic link missing");
  }

  // Stub navigator.connection as unconstrained (4g, saveData: false)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      value: {
        saveData: false,
        effectiveType: "4g",
      },
      writable: false,
    });
  });

  // Sign in
  await page.goto(
    `/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);

  // Navigate to dashboard with sidebar
  await page.goto("/dashboard");
  await expect(page.locator("[data-customer-shell]")).toBeVisible();

  // Wait for the automatic prefetch to fire (idle callback or 200ms timeout)
  // Give it extra time to be safe
  await page.waitForTimeout(400);

  // Assert prefetch link WAS auto-appended for the sidebar Home link href
  const prefetchLinks = await page
    .locator('link[rel="prefetch"][as="document"][href="/r/atelier-demo"]')
    .count();
  expect(prefetchLinks).toBeGreaterThan(0);
});

test("constrained connection still allows user-intent prefetch on hover", async ({
  page,
}) => {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Test requires local Supabase variables.");
  }

  await seedDemoData({ supabaseUrl, anonKey, serviceRoleKey });
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  // Authenticate as demo customer
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: DEMO_EMAIL,
  });
  if (error || !link.properties) {
    throw error ?? new Error("magic link missing");
  }

  // Stub navigator.connection as constrained (effectiveType: '2g')
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      value: {
        saveData: false,
        effectiveType: "2g",
      },
      writable: false,
    });
  });

  // Sign in
  await page.goto(
    `/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);

  // Navigate to dashboard with sidebar
  await page.goto("/dashboard");
  await expect(page.locator("[data-customer-shell]")).toBeVisible();

  // Wait past the automatic prefetch window to ensure none fired
  await page.waitForTimeout(400);

  // Assert NO prefetch from automatic mount
  let prefetchLinks = await page
    .locator('link[rel="prefetch"][as="document"][href="/r/atelier-demo"]')
    .count();
  expect(prefetchLinks).toBe(0);

  // Now hover over the Home link to trigger user-intent prefetch
  const homeLink = page.locator('a:has-text("Home")').first();
  await homeLink.hover();

  // Give the prefetch callback a moment to execute
  await page.waitForTimeout(100);

  // Assert prefetch link NOW appears due to user intent
  prefetchLinks = await page
    .locator('link[rel="prefetch"][as="document"][href="/r/atelier-demo"]')
    .count();
  expect(prefetchLinks).toBeGreaterThan(0);
});
