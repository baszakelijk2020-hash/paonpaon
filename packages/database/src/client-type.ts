import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./generated/database.types";

/**
 * The one canonical alias for "a Supabase client typed against our
 * schema," used by every factory and repository. Deriving
 * `SupabaseClient<Database>` independently in multiple files trips
 * spurious structural-assignability errors under
 * `exactOptionalPropertyTypes` between @supabase/ssr's and
 * @supabase/supabase-js's own generic default expansions — see
 * docs/DECISIONS.md ADR-010.
 */
export type PaonSupabaseClient = SupabaseClient<Database>;
