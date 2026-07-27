const RETRY_DELAYS_MS = [150, 400, 900];

/**
 * Supabase's hosted Postgres/PostgREST layer intermittently rejects an
 * otherwise-valid, freshly-minted JWT with `PGRST303` ("JWT issued at
 * future") — a transient clock-sync gap between the Auth service that
 * mints the token and whichever Postgres/PostgREST node happens to
 * serve the request, not a defect in the token or the caller. It
 * reliably succeeds moments later. Confirmed in production runtime
 * logs: this was intermittently bouncing already-accepted staff to
 * /accept-invite on both the admin and retailer apps.
 *
 * Safe to retry regardless of HTTP method — PGRST303 is a rejection at
 * the JWT-verification stage, before PostgREST dispatches the
 * underlying SQL statement, so a retried mutation cannot double-apply.
 */
export async function fetchWithJwtClockSkewRetry(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): ReturnType<typeof fetch> {
  let lastResponse: Response | undefined;
  for (const delayMs of [0, ...RETRY_DELAYS_MS]) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const response = await fetch(input, init);
    if (response.status < 400) return response;
    const body = await response
      .clone()
      .text()
      .catch(() => "");
    if (!body.includes("PGRST303")) return response;
    lastResponse = response;
  }
  return lastResponse!;
}
