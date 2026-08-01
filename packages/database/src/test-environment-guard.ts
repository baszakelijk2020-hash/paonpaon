import { assertSafeSupabaseWriteTarget } from "./environment-safety";

if (process.env["PAON_INTEGRATION"] === "1") {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  if (!supabaseUrl) {
    throw new Error(
      "Live integration refused: NEXT_PUBLIC_SUPABASE_URL is missing.",
    );
  }

  assertSafeSupabaseWriteTarget({
    supabaseUrl,
    operation: "PAON_INTEGRATION database suite",
  });
}
