/**
 * Removes keys whose value is `undefined`. Every Server Action across
 * the platform parses raw FormData with a zod schema whose `.optional()`
 * fields infer as `T | undefined` — structurally incompatible with our
 * `exactOptionalPropertyTypes: true` domain types, which mean "absent or
 * present-and-defined." Call this once at the Server Action boundary,
 * right after `.parse()`/`.safeParse()`, rather than re-deriving the
 * same fix per form. See docs/DECISIONS.md ADR-011.
 */
export function stripUndefined<T extends Record<string, unknown>>(
  value: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const result = {} as Record<string, unknown>;
  for (const key of Object.keys(value)) {
    const v = value[key];
    if (v !== undefined) {
      result[key] = v;
    }
  }
  return result as { [K in keyof T]: Exclude<T[K], undefined> };
}
