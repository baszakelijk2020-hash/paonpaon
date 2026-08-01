const LOCAL_SUPABASE_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
  "[::1]",
]);

/**
 * Hosted projects that may contain original, demo, preview, or production
 * data. An operator cannot turn one into a test target by accidentally adding
 * it to an environment variable.
 */
export const PROTECTED_SUPABASE_PROJECT_REFS = new Set([
  "hngxrczavwywsnfceppb",
]);

export interface SafeSupabaseTarget {
  kind: "local" | "allowlisted_disposable";
  projectRef: string | null;
}

function configuredDisposableRefs(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((candidate) => candidate.trim())
      .filter((candidate) => candidate.length > 0),
  );
}

export function supabaseProjectRef(supabaseUrl: string): string | null {
  const parsed = new URL(supabaseUrl);
  const match = /^([a-z0-9]{20})\.supabase\.co$/u.exec(parsed.hostname);
  return match?.[1] ?? null;
}

/**
 * Fail closed before any integration/e2e fixture obtains a service-role
 * client. Local Supabase is always safe. A hosted project must be explicitly
 * classified disposable for this invocation, while known original/production
 * refs remain unconditionally protected.
 */
export function assertSafeSupabaseWriteTarget(args: {
  supabaseUrl: string;
  operation: string;
  disposableProjectRefs?: string;
}): SafeSupabaseTarget {
  let parsed: URL;
  try {
    parsed = new URL(args.supabaseUrl);
  } catch {
    throw new Error(
      `${args.operation} refused: NEXT_PUBLIC_SUPABASE_URL is not a valid URL.`,
    );
  }

  if (LOCAL_SUPABASE_HOSTS.has(parsed.hostname)) {
    return { kind: "local", projectRef: null };
  }

  const projectRef = supabaseProjectRef(args.supabaseUrl);
  if (!projectRef) {
    throw new Error(
      `${args.operation} refused: ${parsed.hostname} is not a local or identifiable hosted Supabase target.`,
    );
  }

  if (PROTECTED_SUPABASE_PROJECT_REFS.has(projectRef)) {
    throw new Error(
      `${args.operation} refused: Supabase project ${projectRef} is protected original/production infrastructure.`,
    );
  }

  const disposableRefs = configuredDisposableRefs(
    args.disposableProjectRefs ?? process.env["PAON_DISPOSABLE_SUPABASE_REFS"],
  );
  if (!disposableRefs.has(projectRef)) {
    throw new Error(
      `${args.operation} refused: hosted Supabase project ${projectRef} is not explicitly allowlisted in PAON_DISPOSABLE_SUPABASE_REFS.`,
    );
  }

  return { kind: "allowlisted_disposable", projectRef };
}
