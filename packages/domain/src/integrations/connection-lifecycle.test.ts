import { describe, expect, it } from "vitest";

import {
  classifyReconciliationSeverity,
  connectionAcceptsIngest,
  planConnectionOperationalTransition,
} from "./connection-lifecycle";

describe("planConnectionOperationalTransition", () => {
  it("allows pausing an active connection", () => {
    expect(
      planConnectionOperationalTransition({
        currentState: "active",
        requestedState: "paused",
      }),
    ).toEqual({ ok: true, nextState: "paused" });
  });

  it("allows resuming a paused connection", () => {
    expect(
      planConnectionOperationalTransition({
        currentState: "paused",
        requestedState: "active",
      }),
    ).toEqual({ ok: true, nextState: "active" });
  });

  it("allows disconnecting from either active or paused", () => {
    expect(
      planConnectionOperationalTransition({
        currentState: "active",
        requestedState: "disconnected",
      }),
    ).toEqual({ ok: true, nextState: "disconnected" });
    expect(
      planConnectionOperationalTransition({
        currentState: "paused",
        requestedState: "disconnected",
      }),
    ).toEqual({ ok: true, nextState: "disconnected" });
  });

  it("rejects a no-op transition to the same state", () => {
    expect(
      planConnectionOperationalTransition({
        currentState: "active",
        requestedState: "active",
      }),
    ).toEqual({ ok: false, reason: "already_in_state" });
  });

  it("rejects reactivating a disconnected connection", () => {
    // A disconnect is a terminal, deliberate boundary: reconnecting means a
    // new connection record with fresh cursors/secrets, not resurrecting the
    // old one's history.
    expect(
      planConnectionOperationalTransition({
        currentState: "disconnected",
        requestedState: "active",
      }),
    ).toEqual({ ok: false, reason: "transition_not_allowed" });
    expect(
      planConnectionOperationalTransition({
        currentState: "disconnected",
        requestedState: "paused",
      }),
    ).toEqual({ ok: false, reason: "transition_not_allowed" });
  });
});

describe("connectionAcceptsIngest", () => {
  it("accepts ingest only while active", () => {
    expect(connectionAcceptsIngest("active")).toBe(true);
    expect(connectionAcceptsIngest("paused")).toBe(false);
    expect(connectionAcceptsIngest("disconnected")).toBe(false);
  });
});

describe("classifyReconciliationSeverity", () => {
  it("is clean when nothing has been considered yet", () => {
    expect(
      classifyReconciliationSeverity({
        matchedCount: 0,
        conflictCount: 0,
        deadLetterCount: 0,
      }),
    ).toBe("clean");
  });

  it("is clean when everything matched", () => {
    expect(
      classifyReconciliationSeverity({
        matchedCount: 500,
        conflictCount: 0,
        deadLetterCount: 0,
      }),
    ).toBe("clean");
  });

  it("is attention when there are conflicts but the dead-letter ratio is low", () => {
    expect(
      classifyReconciliationSeverity({
        matchedCount: 500,
        conflictCount: 3,
        deadLetterCount: 0,
      }),
    ).toBe("attention");
  });

  it("is critical when dead letters make up a meaningful share of the run", () => {
    expect(
      classifyReconciliationSeverity({
        matchedCount: 50,
        conflictCount: 0,
        deadLetterCount: 10,
      }),
    ).toBe("critical");
  });

  it("is attention, not critical, for a single dead letter in a large clean run", () => {
    expect(
      classifyReconciliationSeverity({
        matchedCount: 5000,
        conflictCount: 0,
        deadLetterCount: 1,
      }),
    ).toBe("attention");
  });
});
