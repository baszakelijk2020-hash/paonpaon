import { describe, expect, it } from "vitest";

import { buildMigrationDryRunReport } from "../migration/staged-file-migration";
import { asId } from "../shared/branded-id";

import {
  FADEN_SIGNATURE_SCHEME,
  FADEN_SIGNATURE_TOLERANCE_SECONDS,
  buildFadenWebhookFixtureEnvelope,
  buildFadenWebhookSigningPayload,
  mapShopifyFixtureToStagedRows,
  planFadenWebhookIngestFromFixture,
  verifyFadenWebhookFixture,
  verifyFadenWebhookSignature,
} from "./provider-adapters";
import type { SourceAuthorityPolicy } from "./source-authority";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");

const policy: SourceAuthorityPolicy = {
  id: "pol-1",
  retailerId,
  connectionId: "conn-1",
  domain: "order",
  fieldGroup: "order.status",
  authority: "external",
  allowedDirections: ["ingest"],
  mappingVersion: "faden-webhook-adapter-v1",
  createdAt: "2026-07-30T11:00:00.000Z",
  updatedAt: "2026-07-30T11:00:00.000Z",
};

describe("provider adapters (9.2)", () => {
  it("maps Shopify fixture deltas into staged migration rows", () => {
    const rows = mapShopifyFixtureToStagedRows();
    const report = buildMigrationDryRunReport(rows);
    expect(report.counts.customer).toBe(1);
    expect(report.counts.product).toBe(1);
    expect(report.counts.stock).toBe(1);
    expect(report.counts.order).toBe(1);
    expect(report.expectedOrderMoneyMinor).toBe(52000);
  });

  it("verifies Faden fixture webhook signatures and rejects replay tampering", () => {
    const envelope = buildFadenWebhookFixtureEnvelope();
    expect(verifyFadenWebhookFixture(envelope)).toBe(true);
    expect(
      verifyFadenWebhookFixture({
        ...envelope,
        signature: "sha256:tampered",
      }),
    ).toBe(false);
  });

  it("plans Faden read-only ingest with deep-link and no write-back", () => {
    const planned = planFadenWebhookIngestFromFixture({
      retailerId,
      connectionId: "conn-1",
      policy,
      canonicalOrderId: "cccccccc-cccc-4ccc-8ccc-000000000001",
    });
    expect(planned.ok).toBe(true);
    expect(planned.writeBackClaimed).toBe(false);
    expect(planned.deepLink?.url).toContain("FAD-ORD-2002");
  });
});

describe("verifyFadenWebhookSignature", () => {
  // Stand-in HMAC: deterministic, and sensitive to every byte of the payload —
  // which is the property the deprecated fixture verifier lacks. Production
  // injects node:crypto's createHmac instead.
  const fakeHmac = (secret: string, payload: string): string => {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    const material = `${secret} ${payload}`;
    for (let i = 0; i < material.length; i += 1) {
      h1 = ((h1 ^ material.charCodeAt(i)) * 0x01000193) >>> 0;
      h2 = ((h2 + material.charCodeAt(i) * (i + 1)) ^ (h1 >>> 3)) >>> 0;
    }
    return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  };

  const secret = "faden-live-secret";
  const timestamp = "2026-07-30T11:00:00.000Z";
  const nowMs = Date.parse(timestamp);
  const rawBody = JSON.stringify({ id: "FAD-ORD-2002", type: "order.updated" });

  const sign = (envelope: {
    readonly providerEventId: string;
    readonly timestamp: string;
    readonly rawBody: string;
  }): string =>
    `${FADEN_SIGNATURE_SCHEME}=${fakeHmac(
      secret,
      buildFadenWebhookSigningPayload(envelope),
    )}`;

  const base = { providerEventId: "faden_wh_1", timestamp, rawBody };
  const valid = { ...base, signature: sign(base) };

  it("accepts a correctly signed, in-window envelope", () => {
    expect(
      verifyFadenWebhookSignature({
        envelope: valid,
        sharedSecret: secret,
        computeHmacHex: fakeHmac,
        nowMs,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a tampered body of identical length", () => {
    // Same length, different value: the deprecated fixture verifier accepts
    // this, a real HMAC must not.
    const tamperedBody = rawBody.replace("FAD-ORD-2002", "FAD-ORD-9002");
    expect(tamperedBody).toHaveLength(rawBody.length);
    expect(tamperedBody).not.toEqual(rawBody);

    expect(
      verifyFadenWebhookSignature({
        envelope: { ...valid, rawBody: tamperedBody },
        sharedSecret: secret,
        computeHmacHex: fakeHmac,
        nowMs,
      }),
    ).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("rejects a signature made with the wrong secret", () => {
    const forged = {
      ...base,
      signature: `${FADEN_SIGNATURE_SCHEME}=${fakeHmac(
        "attacker-secret",
        buildFadenWebhookSigningPayload(base),
      )}`,
    };
    expect(
      verifyFadenWebhookSignature({
        envelope: forged,
        sharedSecret: secret,
        computeHmacHex: fakeHmac,
        nowMs,
      }),
    ).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("rejects a replay outside the tolerance window", () => {
    expect(
      verifyFadenWebhookSignature({
        envelope: valid,
        sharedSecret: secret,
        computeHmacHex: fakeHmac,
        nowMs: nowMs + (FADEN_SIGNATURE_TOLERANCE_SECONDS + 1) * 1000,
      }),
    ).toEqual({ ok: false, reason: "timestamp_outside_tolerance" });
  });

  it("rejects a future-dated envelope symmetrically", () => {
    expect(
      verifyFadenWebhookSignature({
        envelope: valid,
        sharedSecret: secret,
        computeHmacHex: fakeHmac,
        nowMs: nowMs - (FADEN_SIGNATURE_TOLERANCE_SECONDS + 1) * 1000,
      }),
    ).toEqual({ ok: false, reason: "timestamp_outside_tolerance" });
  });

  it("accepts an envelope at the exact tolerance edge", () => {
    expect(
      verifyFadenWebhookSignature({
        envelope: valid,
        sharedSecret: secret,
        computeHmacHex: fakeHmac,
        nowMs: nowMs + FADEN_SIGNATURE_TOLERANCE_SECONDS * 1000,
      }),
    ).toEqual({ ok: true });
  });

  it("binds the provider event id, so a signature cannot be reused elsewhere", () => {
    expect(
      verifyFadenWebhookSignature({
        envelope: { ...valid, providerEventId: "faden_wh_2" },
        sharedSecret: secret,
        computeHmacHex: fakeHmac,
        nowMs,
      }),
    ).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("distinguishes malformed material from a genuine mismatch", () => {
    expect(
      verifyFadenWebhookSignature({
        envelope: { ...valid, signature: "sha256:not-our-scheme" },
        sharedSecret: secret,
        computeHmacHex: fakeHmac,
        nowMs,
      }),
    ).toEqual({ ok: false, reason: "signature_malformed" });

    expect(
      verifyFadenWebhookSignature({
        envelope: { ...valid, signature: `${FADEN_SIGNATURE_SCHEME}=ZZZZ` },
        sharedSecret: secret,
        computeHmacHex: fakeHmac,
        nowMs,
      }),
    ).toEqual({ ok: false, reason: "signature_malformed" });

    const badStamp = { ...base, timestamp: "not-a-date" };
    expect(
      verifyFadenWebhookSignature({
        envelope: { ...badStamp, signature: sign(badStamp) },
        sharedSecret: secret,
        computeHmacHex: fakeHmac,
        nowMs,
      }),
    ).toEqual({ ok: false, reason: "timestamp_malformed" });
  });

  it("records why the deprecated fixture verifier must not guard a route", () => {
    const fixture = buildFadenWebhookFixtureEnvelope();
    const tampered = {
      ...fixture,
      rawBody: fixture.rawBody.replace("FAD-ORD-2002", "FAD-ORD-9002"),
    };
    expect(tampered.rawBody).toHaveLength(fixture.rawBody.length);
    // Documents the defect rather than asserting it is acceptable.
    expect(verifyFadenWebhookFixture(tampered)).toBe(true);
  });
});
