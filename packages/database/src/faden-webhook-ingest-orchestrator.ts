import type {
  FadenSignatureVerification,
  FadenWebhookEnvelope,
  RetailerId,
  SourceAuthorityPolicy,
} from "@paon/domain";

import type { PaonSupabaseClient } from "./client-type";
import { IntegrationLifecycleRepository } from "./repositories/integration-lifecycle-repository";
import { SourceAuthorityRepository } from "./repositories/source-authority-repository";

export interface FadenWebhookIngestArgs {
  readonly retailerId: RetailerId;
  readonly connectionId: string;
  readonly policy: SourceAuthorityPolicy;
  readonly envelope: FadenWebhookEnvelope;
  /**
   * Computed by the caller via verifyFadenWebhookSignature. This function
   * never sees the shared secret and never computes an HMAC or hash
   * itself, so @paon/database stays free of node:crypto — the same
   * edge-injection boundary @paon/domain's provider-adapters.ts establishes,
   * carried one layer further out to the route handler that owns the
   * secret.
   */
  readonly verification: FadenSignatureVerification;
  /** sha256 of envelope.rawBody, computed by the caller. */
  readonly payloadHash: string;
  readonly externalObjectType: "client" | "order";
  readonly externalId: string;
  readonly canonicalObjectType: "customer" | "order";
  /**
   * Omit when the canonical PAON record for this external id is not yet
   * known to the caller. The orchestrator then resolves it from an
   * existing external_identities mapping and, if none exists, dead-letters
   * the event rather than inventing a canonical id — there is no source of
   * truth this connector could consult to manufacture one, and 9.1's own
   * non-goal ("no silent AI identity merge") applies equally to a webhook
   * guessing a match.
   */
  readonly canonicalId?: string;
  readonly mappingVersion: string;
  readonly triggerKind?: "webhook" | "manual";
}

export type FadenWebhookIngestRejectionReason =
  | "connection_not_active"
  | "signature_rejected"
  | "unmapped_external_object"
  | "ingest_conflict";

export type FadenWebhookIngestResult =
  | { readonly ok: true; readonly runId: string; readonly identityId: string }
  | {
      readonly ok: false;
      readonly runId: string;
      readonly reason: FadenWebhookIngestRejectionReason;
      readonly detail?: string;
    };

/**
 * Drives one Faden webhook delivery end to end (PHASE 9.2): connection
 * operational-state check, run bookkeeping, dead-lettering on rejection,
 * and the existing source-authority ingest (PHASE 8.2) on acceptance.
 *
 * This is the executable lifecycle 9.2's acceptance criteria requires —
 * "signature/replay/cursor/failure/retry/reconcile are observable" — as one
 * function a route handler can call, rather than each concern living
 * unconnected in its own fixture.
 */
export async function ingestFadenWebhook(
  admin: PaonSupabaseClient,
  args: FadenWebhookIngestArgs,
): Promise<FadenWebhookIngestResult> {
  const lifecycle = new IntegrationLifecycleRepository(admin);
  const sourceAuthority = new SourceAuthorityRepository(admin);

  const acceptsIngest = await lifecycle.connectionAcceptsIngestNow({
    retailerId: args.retailerId,
    connectionId: args.connectionId,
  });

  const run = await lifecycle.startSyncRun({
    retailerId: args.retailerId,
    connectionId: args.connectionId,
    triggerKind: args.triggerKind ?? "webhook",
  });

  // Checked before signature verification's own rejection, so a paused
  // connection never appears in the dead-letter list as a signature
  // problem — an operator resolving dead letters needs the true cause, and
  // "we turned this off on purpose" is not a signature failure.
  if (!acceptsIngest) {
    await lifecycle.recordDeadLetter({
      retailerId: args.retailerId,
      connectionId: args.connectionId,
      runId: run.id,
      providerEventId: args.envelope.providerEventId,
      failureReason: "downstream_error",
      failureDetail: { reason: "connection_not_active" },
    });
    await lifecycle.finishSyncRun({
      retailerId: args.retailerId,
      runId: run.id,
      status: "failed",
      recordsProcessed: 0,
      recordsFailed: 1,
      errorSummary: "connection is not active",
    });
    return { ok: false, runId: run.id, reason: "connection_not_active" };
  }

  if (!args.verification.ok) {
    const failureReason =
      args.verification.reason === "timestamp_outside_tolerance"
        ? "replay_rejected"
        : "signature_invalid";
    await lifecycle.recordDeadLetter({
      retailerId: args.retailerId,
      connectionId: args.connectionId,
      runId: run.id,
      providerEventId: args.envelope.providerEventId,
      failureReason,
      failureDetail: { reason: args.verification.reason },
    });
    await lifecycle.finishSyncRun({
      retailerId: args.retailerId,
      runId: run.id,
      status: "failed",
      recordsProcessed: 0,
      recordsFailed: 1,
      errorSummary: `signature verification failed: ${args.verification.reason}`,
    });
    return {
      ok: false,
      runId: run.id,
      reason: "signature_rejected",
      detail: args.verification.reason,
    };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(args.envelope.rawBody) as Record<string, unknown>;
  } catch {
    await lifecycle.recordDeadLetter({
      retailerId: args.retailerId,
      connectionId: args.connectionId,
      runId: run.id,
      providerEventId: args.envelope.providerEventId,
      failureReason: "validation_error",
      failureDetail: { reason: "raw_body_not_json" },
    });
    await lifecycle.finishSyncRun({
      retailerId: args.retailerId,
      runId: run.id,
      status: "failed",
      recordsProcessed: 0,
      recordsFailed: 1,
      errorSummary: "webhook body was not valid JSON",
    });
    return {
      ok: false,
      runId: run.id,
      reason: "signature_rejected",
      detail: "raw_body_not_json",
    };
  }

  let canonicalId = args.canonicalId;
  if (!canonicalId) {
    const existing = await sourceAuthority.findIdentityByExternal({
      retailerId: args.retailerId,
      connectionId: args.connectionId,
      domain: args.policy.domain,
      externalObjectType: args.externalObjectType,
      externalId: args.externalId,
    });
    if (!existing) {
      await lifecycle.recordDeadLetter({
        retailerId: args.retailerId,
        connectionId: args.connectionId,
        runId: run.id,
        providerEventId: args.envelope.providerEventId,
        failureReason: "mapping_error",
        failureDetail: {
          reason: "unmapped_external_object",
          externalObjectType: args.externalObjectType,
          externalId: args.externalId,
        },
      });
      await lifecycle.finishSyncRun({
        retailerId: args.retailerId,
        runId: run.id,
        status: "failed",
        recordsProcessed: 0,
        recordsFailed: 1,
        errorSummary: `no canonical mapping exists yet for ${args.externalObjectType} ${args.externalId}`,
      });
      return { ok: false, runId: run.id, reason: "unmapped_external_object" };
    }
    canonicalId = existing.canonicalId;
  }

  const ingestResult = await sourceAuthority.ingestFadenReadOnly(
    {
      retailerId: args.retailerId,
      connectionId: args.connectionId,
      policy: args.policy,
      providerEventId: args.envelope.providerEventId,
      payloadHash: args.payloadHash,
      receivedAt: args.envelope.timestamp,
      mappingVersion: args.mappingVersion,
      externalObjectType: args.externalObjectType,
      externalId: args.externalId,
      externalUpdatedAt: args.envelope.timestamp,
      canonicalObjectType: args.canonicalObjectType,
      canonicalId,
    },
    payload,
  );

  await lifecycle.upsertSyncCursor({
    retailerId: args.retailerId,
    connectionId: args.connectionId,
    resource: args.externalObjectType,
    cursorValue: { lastProviderEventId: args.envelope.providerEventId },
  });

  // FadenIngestPersistResult types identity as optional even when ok is
  // true (it models a raw boolean flag, not a discriminated union tag), so
  // treat a missing identity on the success path as its own failure rather
  // than asserting past what the type actually promises.
  if (!ingestResult.ok || !ingestResult.identity) {
    await lifecycle.recordDeadLetter({
      retailerId: args.retailerId,
      connectionId: args.connectionId,
      runId: run.id,
      providerEventId: args.envelope.providerEventId,
      failureReason: "mapping_error",
      failureDetail: {
        conflictCode: ingestResult.conflictCode,
        conflictMessage: ingestResult.conflictMessage,
      },
    });
    await lifecycle.finishSyncRun({
      retailerId: args.retailerId,
      runId: run.id,
      status: "failed",
      recordsProcessed: 0,
      recordsFailed: 1,
      errorSummary: ingestResult.conflictMessage ?? "source authority conflict",
    });
    return { ok: false, runId: run.id, reason: "ingest_conflict" };
  }

  await lifecycle.finishSyncRun({
    retailerId: args.retailerId,
    runId: run.id,
    status: "succeeded",
    recordsProcessed: 1,
    recordsFailed: 0,
  });

  // Record reconciliation report for this webhook delivery
  const reconciliationStatus = ingestResult.identity.reconciliationStatus;
  const matchedCount = reconciliationStatus === "matched" ? 1 : 0;
  const conflictCount = reconciliationStatus === "conflict" ? 1 : 0;
  const staleCount = reconciliationStatus === "stale" ? 1 : 0;

  await lifecycle.recordReconciliationReport({
    retailerId: args.retailerId,
    connectionId: args.connectionId,
    runId: run.id,
    resource: args.externalObjectType,
    matchedCount,
    conflictCount,
    staleCount,
    deadLetterCount: 0,
  });

  return { ok: true, runId: run.id, identityId: ingestResult.identity.id };
}
