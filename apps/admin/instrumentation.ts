import type { Instrumentation } from "next";

/**
 * Server-side production error capture (ship-readiness Blocker 2). Next.js
 * calls onRequestError for uncaught errors in Server Components, Route
 * Handlers and Server Actions — the paths that previously died silently.
 * Client-side render errors are separately caught by app/global-error.tsx.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
) => {
  const { reportError } = await import("@paon/database/error-reporting");
  const stack = err instanceof Error ? err.stack : undefined;
  await reportError({
    app: "admin",
    environment: process.env["VERCEL_ENV"] ?? process.env.NODE_ENV ?? "unknown",
    route: request.path,
    message: err instanceof Error ? err.message : String(err),
    ...(stack !== undefined ? { stack } : {}),
  });
};
