import { describe, expect, it } from "vitest";

import { computeExceptionDueAt, isExceptionOverdue } from "./service-desk";

describe("computeExceptionDueAt", () => {
  it("adds the urgent SLA (4 hours)", () => {
    expect(
      computeExceptionDueAt({
        priority: "urgent",
        fromIso: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe("2026-01-01T04:00:00.000Z");
  });

  it("adds the low SLA (168 hours / 7 days)", () => {
    expect(
      computeExceptionDueAt({
        priority: "low",
        fromIso: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe("2026-01-08T00:00:00.000Z");
  });
});

describe("isExceptionOverdue", () => {
  it("is false before the due date", () => {
    expect(
      isExceptionOverdue({
        dueAt: "2026-01-02T00:00:00.000Z",
        now: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("is true past the due date when unresolved", () => {
    expect(
      isExceptionOverdue({
        dueAt: "2026-01-01T00:00:00.000Z",
        now: "2026-01-02T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("is false once resolved, even past the due date", () => {
    expect(
      isExceptionOverdue({
        dueAt: "2026-01-01T00:00:00.000Z",
        resolvedAt: "2026-01-01T12:00:00.000Z",
        now: "2026-01-02T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("is false when there is no due date at all", () => {
    expect(isExceptionOverdue({ now: "2026-01-02T00:00:00.000Z" })).toBe(false);
  });
});
