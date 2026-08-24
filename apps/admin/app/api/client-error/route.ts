import { reportError } from "@paon/database/error-reporting";
import { NextResponse } from "next/server";
import { z } from "zod";

const clientErrorSchema = z.object({
  message: z.string().min(1).max(4000),
  stack: z.string().max(8000).optional(),
  digest: z.string().max(200).optional(),
  route: z.string().max(500).optional(),
});

/**
 * Receives render-crash reports from app/global-error.tsx. Client code
 * can't call the server-only reporter directly, so this route relays into
 * it. Always responds 204 — a broken report must never itself error.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = clientErrorSchema.safeParse(body);
  if (parsed.success) {
    await reportError({
      app: "admin",
      environment:
        process.env["VERCEL_ENV"] ?? process.env.NODE_ENV ?? "unknown",
      message: parsed.data.message,
      ...(parsed.data.stack !== undefined ? { stack: parsed.data.stack } : {}),
      ...(parsed.data.route !== undefined ? { route: parsed.data.route } : {}),
      context: parsed.data.digest ? { digest: parsed.data.digest } : {},
    });
  }
  return new NextResponse(null, { status: 204 });
}
