const DEFAULT_DELAYS_MS = [300, 600, 1000, 1500, 2000, 2500, 3000];

/**
 * Retries a read that's expected to find a row that we have strong
 * independent evidence must already exist (e.g. a staff record for a
 * user who just presented a valid, freshly-issued session token for
 * that exact account). Confirmed in production: a query for a row
 * proven to exist (verified by re-querying with a service-role client
 * bypassing RLS) intermittently comes back empty with no error —
 * consistent with read-replica lag on Supabase's hosted Postgres, not
 * an application bug. A blind retry is the correct response, not
 * treating a transient empty read as "the row doesn't exist."
 *
 * Only meant for this narrow "we know it should be there" case, not a
 * general substitute for consistent reads — an actually-absent row
 * (e.g. a genuinely not-yet-accepted invite) still correctly resolves
 * to `null` after retries are exhausted.
 */
export async function retryUntilFound<T>(
  read: () => Promise<T | null>,
  isFound: (value: T | null) => boolean = (value) => value !== null,
): Promise<T | null> {
  let last = await read();
  for (const delayMs of DEFAULT_DELAYS_MS) {
    if (isFound(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    last = await read();
  }
  return last;
}
