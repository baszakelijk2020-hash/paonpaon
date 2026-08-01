export const TEST_CUSTOMER_EMAIL = "e2e-shopper@paon.test";
export const TEST_RETAILER_SLUG = "e2e-customer-workspace";
export const TEST_RETAILER_DISPLAY_NAME = "E2E Customer Workspace";
export const TEST_PRODUCT_SLUG = "e2e-storefront-overcoat";

/**
 * Domain for addresses that must survive a real Supabase Auth call.
 *
 * `@paon.test` is fine for rows written straight to the database. It is NOT
 * fine for a magic link or an invite: Auth validates the address and rejects
 * the reserved `.test` TLD, so the request fails and the page shows an error
 * instead of the confirmation.
 */
export const AUTH_DELIVERABLE_DOMAIN = "nebelspiegel.com";
