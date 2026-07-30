"use server";

import { CustomerSessionRepository } from "@paon/database";
import {
  asId,
  buildSessionContextProperties,
  type SessionContextEventName,
  type SessionVisibilityState,
} from "@paon/domain";

import { captureSignedInInteractionEvent } from "@/lib/capture-interaction-event";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const tieMateRoute = (slug: string) => `/r/${slug}/tie-mate`;

export async function startTieMateSession(args: {
  readonly retailerId: string;
  readonly slug: string;
  readonly resumeSessionId?: string;
}): Promise<
  | {
      readonly ok: true;
      readonly sessionId: string;
      readonly resumed: boolean;
    }
  | { readonly ok: false }
> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const retailerId = asId<"RetailerId">(args.retailerId);
  const route = tieMateRoute(args.slug);

  try {
    const sessions = new CustomerSessionRepository(supabase);
    const resumeSessionId = args.resumeSessionId
      ? asId<"CustomerInteractionSessionId">(args.resumeSessionId)
      : undefined;

    const sessionId = await sessions.start({
      retailerId,
      route,
      ...(resumeSessionId ? { resumeSessionId } : {}),
    });

    const resumed = Boolean(resumeSessionId && sessionId === resumeSessionId);

    const lifecycleKey = `${sessionId}:${resumed ? "session_resumed" : "session_started"}`;
    await captureSignedInInteractionEvent({
      retailerId: args.retailerId,
      name: resumed ? "session_resumed" : "session_started",
      sessionId,
      idempotencyKey: lifecycleKey,
      properties: buildSessionContextProperties({
        sessionId,
        route,
        idempotencyKey: lifecycleKey,
        context: { via: "tie_mate" },
      }),
    });

    await captureSignedInInteractionEvent({
      retailerId: args.retailerId,
      name: "route_impression",
      sessionId,
      idempotencyKey: `${sessionId}:route_impression`,
      properties: buildSessionContextProperties({
        sessionId,
        route,
        idempotencyKey: `${sessionId}:route_impression`,
        context: { via: "tie_mate" },
      }),
    });

    return { ok: true, sessionId, resumed };
  } catch {
    return { ok: false };
  }
}

export async function heartbeatTieMateSession(args: {
  readonly retailerId: string;
  readonly slug: string;
  readonly sessionId: string;
  readonly visibilityState: SessionVisibilityState;
}): Promise<{ readonly ok: true } | { readonly ok: false }> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const route = tieMateRoute(args.slug);
  const sessionId = asId<"CustomerInteractionSessionId">(args.sessionId);

  try {
    await new CustomerSessionRepository(supabase).heartbeat({
      sessionId,
      visibilityState: args.visibilityState,
      route,
    });

    const minuteBucket = Math.floor(Date.now() / 60_000);
    const heartbeatKey = `${sessionId}:heartbeat:${args.visibilityState}:${minuteBucket}`;
    await captureSignedInInteractionEvent({
      retailerId: args.retailerId,
      name: "session_heartbeat",
      sessionId: args.sessionId,
      idempotencyKey: heartbeatKey,
      properties: buildSessionContextProperties({
        sessionId,
        route,
        idempotencyKey: heartbeatKey,
        context: {
          via: "tie_mate",
          visibilityState: args.visibilityState,
        },
      }),
    });

    if (args.visibilityState !== "visible") {
      const visibilityKey = `${sessionId}:visibility:${args.visibilityState}:${minuteBucket}`;
      await captureSignedInInteractionEvent({
        retailerId: args.retailerId,
        name: "page_visibility_changed",
        sessionId: args.sessionId,
        idempotencyKey: visibilityKey,
        properties: buildSessionContextProperties({
          sessionId,
          route,
          idempotencyKey: visibilityKey,
          context: {
            via: "tie_mate",
            visibilityState: args.visibilityState,
          },
        }),
      });
    }

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function endTieMateSession(args: {
  readonly retailerId: string;
  readonly slug: string;
  readonly sessionId: string;
}): Promise<{ readonly ok: true } | { readonly ok: false }> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const route = tieMateRoute(args.slug);
  const sessionId = asId<"CustomerInteractionSessionId">(args.sessionId);

  try {
    await new CustomerSessionRepository(supabase).end(sessionId);
    const idempotencyKey = `${sessionId}:session_ended`;
    await captureSignedInInteractionEvent({
      retailerId: args.retailerId,
      name: "session_ended",
      sessionId: args.sessionId,
      idempotencyKey,
      properties: buildSessionContextProperties({
        sessionId,
        route,
        idempotencyKey,
        context: { via: "tie_mate" },
      }),
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function trackTieMateContextEvent(args: {
  readonly retailerId: string;
  readonly slug: string;
  readonly sessionId: string;
  readonly name: SessionContextEventName;
  readonly idempotencyKey: string;
  readonly context?: Record<string, unknown>;
}): Promise<void> {
  await requireSession();
  const sessionId = asId<"CustomerInteractionSessionId">(args.sessionId);
  const route = tieMateRoute(args.slug);

  await captureSignedInInteractionEvent({
    retailerId: args.retailerId,
    name: args.name,
    sessionId: args.sessionId,
    idempotencyKey: args.idempotencyKey,
    properties: buildSessionContextProperties({
      sessionId,
      route,
      idempotencyKey: args.idempotencyKey,
      context: { via: "tie_mate", ...(args.context ?? {}) },
    }),
  });
}
