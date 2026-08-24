"use client";

import { useEffect } from "react";

/**
 * Catches render errors Next.js can't recover from (root layout included).
 * Reports to /api/client-error rather than importing server-only code
 * directly, since this file ships to the browser.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        route:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
      keepalive: true,
    }).catch(() => {
      // Reporting must never compound the outage it's reporting.
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
          <h1>Something went wrong.</h1>
          <p>Our team has been notified. Please try again shortly.</p>
        </div>
      </body>
    </html>
  );
}
