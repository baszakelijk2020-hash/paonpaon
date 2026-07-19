import type { PostgrestError } from "@supabase/supabase-js";

export interface FakeQueryResult<T> {
  data: T;
  error: PostgrestError | null;
}

/**
 * Minimal stand-in for a Supabase PostgrestQueryBuilder: every chain
 * method returns itself, and the object is thenable so `await
 * client.from(...).select(...)...` resolves the same way it does
 * against a real query with no terminal `.single()`/`.maybeSingle()`
 * call. Shared across repository unit tests instead of re-mocking the
 * fluent API per test file.
 */
export function fakeQueryBuilder<T>(result: FakeQueryResult<T>) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    lte: () => chain,
    or: () => chain,
    in: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => chain,
    insert: () => chain,
    upsert: () => chain,
    update: () => chain,
    delete: () => chain,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (onFulfilled: (value: FakeQueryResult<T>) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
  };
  return chain;
}
