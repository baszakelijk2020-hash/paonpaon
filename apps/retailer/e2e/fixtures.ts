export const TEST_OWNER_EMAIL = "e2e-owner@paon.test";
export const TEST_OWNER_PASSWORD = "E2E-test-password-123!";
export const TEST_RETAILER_SLUG = "e2e-retailer-workspace";
export const TEST_ORDER_PRODUCT_SLUG = "e2e-order-fixture-product";

/**
 * Domain for addresses that must survive a real Supabase Auth call.
 *
 * `@paon.test` is fine for rows written straight to the database, and most
 * fixtures use it. It is NOT fine for anything routed through
 * `inviteUserByEmail`: Auth validates the address and rejects the reserved
 * `.test` TLD outright, so the invite fails with "Email address ... is
 * invalid". The product reports that correctly — the fixture was wrong.
 */
export const AUTH_DELIVERABLE_DOMAIN = "nebelspiegel.com";
