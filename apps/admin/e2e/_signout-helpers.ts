import type { BrowserContext } from "@playwright/test";

/**
 * Shared helpers for the global sign-out cross-context proofs
 * (customer/retailer/admin *-signout-v3.spec.ts). A Supabase SSR session
 * cookie is named `sb-<ref>-auth-token` (optionally chunked into
 * `sb-<ref>-auth-token.0`, `.1`, … when the encoded session exceeds one
 * cookie's practical size) and holds `base64-<base64 of the Session JSON>`.
 * These helpers decode that cookie to read/rewrite the embedded session
 * without ever touching product code — the proof exercises the same cookie
 * shape the app itself reads.
 *
 * Callers should snapshot a context's auth cookie chunks with
 * `snapshotAuthCookies` immediately after signing in, and keep that
 * snapshot around rather than re-reading the context's live cookies later.
 * The browser's own Supabase client watches token refresh and can clear its
 * session cookie on its own once a refresh fails (e.g. after global
 * sign-out revokes it elsewhere) even with no navigation in that context —
 * a live re-read after that point can race the app's own cleanup. The
 * snapshot is unaffected by whatever the app does afterward, so it stays a
 * reliable base for both the baseline refresh-token check and the later
 * simulated-expiry rewrite.
 */

export interface AuthCookieChunk {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
}

function chunkSuffix(name: string): number {
  const match = /\.(\d+)$/.exec(name);
  return match ? Number(match[1]) : -1;
}

/** Captures the context's current `sb-*-auth-token` cookie(s) verbatim.
 * Call this right after signing in — see the module doc comment for why a
 * later live re-read is unreliable. */
export async function snapshotAuthCookies(
  context: BrowserContext,
): Promise<AuthCookieChunk[]> {
  const cookies = await context.cookies();
  const chunks = cookies
    .filter(
      (cookie) =>
        cookie.name.includes("-auth-token") &&
        !cookie.name.includes("code-verifier"),
    )
    .sort(
      (a, b) => chunkSuffix(a.name) - chunkSuffix(b.name),
    ) as AuthCookieChunk[];
  if (chunks.length === 0) {
    throw new Error("No sb-*-auth-token cookie found in this context.");
  }
  return chunks;
}

function decodeSessionPayload(combined: string): Record<string, unknown> {
  const base64Payload = combined.startsWith("base64-")
    ? combined.slice("base64-".length)
    : combined;
  const json = Buffer.from(base64Payload, "base64").toString("utf-8");
  return JSON.parse(json) as Record<string, unknown>;
}

function encodeSessionPayload(session: Record<string, unknown>): string {
  return `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
}

/** Reads the `refresh_token` out of a snapshot taken by `snapshotAuthCookies`. */
export function refreshTokenFromSnapshot(chunks: AuthCookieChunk[]): string {
  const combined = chunks.map((chunk) => chunk.value).join("");
  const session = decodeSessionPayload(combined);
  const refreshToken = session["refresh_token"];
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    throw new Error("Session cookie decoded but had no refresh_token.");
  }
  return refreshToken;
}

/** Overwrites (or, if the app already cleared it client-side, re-creates)
 * the context's session cookie(s) from an earlier `snapshotAuthCookies`
 * snapshot, with the embedded session's `expires_at` moved one hour into
 * the past — simulating a stale/expired access token while keeping the
 * (now server-revoked) refresh token in place, so a reload forces the app
 * to actually attempt — and fail — token refresh instead of coasting on a
 * cached access token. Preserves chunk boundaries (proportionally) so the
 * rewritten cookies stay under the size that caused the original value to
 * be split. Uses `context.addCookies`, which sets by name/domain/path
 * regardless of whether that cookie currently exists in the context. */
export async function applyExpiredSession(
  context: BrowserContext,
  chunks: AuthCookieChunk[],
): Promise<void> {
  const lengths = chunks.map((chunk) => chunk.value.length);
  const combined = chunks.map((chunk) => chunk.value).join("");
  const session = decodeSessionPayload(combined);
  session["expires_at"] = Math.floor(Date.now() / 1000) - 3600;
  const rewritten = encodeSessionPayload(session);

  let offset = 0;
  const newValues = lengths.map((length, index) => {
    if (index === lengths.length - 1) return rewritten.slice(offset);
    const slice = rewritten.slice(offset, offset + length);
    offset += length;
    return slice;
  });

  await context.addCookies(
    chunks.map((chunk, index) => ({
      name: chunk.name,
      value: newValues[index] ?? "",
      domain: chunk.domain,
      path: chunk.path,
      expires: chunk.expires,
      httpOnly: chunk.httpOnly,
      secure: chunk.secure,
      sameSite: chunk.sameSite,
    })),
  );
}

/** POSTs a refresh token to Supabase Auth's own token endpoint and returns
 * the HTTP status — 200 while the token is still live, 400 once its whole
 * session has been globally revoked. Bypasses the app entirely so the
 * assertion is about Supabase Auth state, not app-level caching. */
export async function refreshTokenStatus(
  supabaseUrl: string,
  anonKey: string,
  refreshToken: string,
): Promise<number> {
  const response = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  );
  return response.status;
}

export function requireSupabaseTestEnv(): {
  supabaseUrl: string;
  anonKey: string;
} {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { supabaseUrl, anonKey };
}
