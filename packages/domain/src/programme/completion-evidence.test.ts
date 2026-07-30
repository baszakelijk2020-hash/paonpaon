import { describe, expect, it } from "vitest";

import {
  buildBrowserProofRunArtifact,
  mayMarkPhaseItemComplete,
  parseCompletionEvidenceRecord,
  validateCompletionEvidence,
  type CompletionEvidenceRecord,
  type CompletionEvidenceValidateOptions,
} from "./completion-evidence";

const HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function passedRun(
  overrides: {
    phaseItemId?: string;
    gitSha?: string;
    spec?: string;
    status?: "passed" | "failed";
  } = {},
) {
  return buildBrowserProofRunArtifact({
    phaseItemId: overrides.phaseItemId ?? "8.4",
    gitSha: overrides.gitSha ?? HEAD,
    spec: overrides.spec ?? "apps/retailer/e2e/completion-harness.spec.ts",
    status: overrides.status ?? "passed",
    timestamp: "2026-07-30T00:00:00.000Z",
  });
}

function verifiedOptions(
  overrides: Partial<CompletionEvidenceValidateOptions> = {},
): CompletionEvidenceValidateOptions {
  return {
    pathExists: () => true,
    currentGitSha: HEAD,
    readBrowserProofRun: () => passedRun(),
    ...overrides,
  };
}

function baseRecord(
  overrides: Partial<CompletionEvidenceRecord> = {},
): CompletionEvidenceRecord {
  return {
    phaseItemId: "8.4",
    requirementIds: ["AUD-001", "AUD-002", "AUD-003", "AUD-004", "AUD-005"],
    status: "verified_local",
    title: "Machine-enforced completion and multi-role journey gate",
    applicability: {
      domain: "required",
      persistence: "required",
      service: "required",
      origin_ui: "required",
      receiver_ui: "required",
      rls: "required",
      exceptions: "required",
      browser: "required",
      operations: "required",
      live_gap: "n_a",
    },
    evidence: {
      domain: "packages/domain/src/programme/completion-evidence.ts",
      persistence: "packages/database/src/programme-proof-seed.ts",
      service: "packages/domain/src/programme/validate-phase-completion.ts",
      origin_ui: "apps/retailer/app/(dashboard)/customers/[id]/page.tsx",
      receiver_ui: "apps/retailer/app/(dashboard)/customers/[id]/page.tsx",
      rls: "supabase/migrations/20260720000003_create_clienteling_notes.sql",
      exceptions: "apps/retailer/e2e/completion-harness.spec.ts",
      browser: "apps/retailer/e2e/completion-harness.spec.ts",
      operations: "packages/domain/scripts/validate-completion-evidence.ts",
      live_gap: "No hosted live credential gap for this local tranche",
    },
    uiChecklist: {
      loading: "n_a",
      empty: "proven",
      error: "n_a",
      denied: "proven",
      stale: "n_a",
      conflict: "n_a",
      success: "proven",
      role_orientation: "proven",
      task_continuation: "proven",
      phone: "n_a",
      tablet: "n_a",
      desktop: "proven",
      keyboard_a11y: "n_a",
    },
    linkedSeedId: "paon-proof-maison-dubois-v1",
    browserProofSpec: "apps/retailer/e2e/completion-harness.spec.ts",
    assertedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("completion evidence validator", () => {
  it("accepts a complete verified_local record with a current passed run", () => {
    const options = verifiedOptions();
    const result = validateCompletionEvidence(baseRecord(), options);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(mayMarkPhaseItemComplete(baseRecord(), options)).toBe(true);
  });

  it("rejects verified_local when the run artifact is missing", () => {
    const result = validateCompletionEvidence(
      baseRecord(),
      verifiedOptions({
        pathExists: (path) => !path.includes("docs/evidence/runs/"),
        readBrowserProofRun: () => null,
      }),
    );
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.field === "browserProofRun"),
    ).toBe(true);
  });

  it("rejects verified_local when the run status is not passed", () => {
    const result = validateCompletionEvidence(
      baseRecord(),
      verifiedOptions({
        readBrowserProofRun: () => passedRun({ status: "failed" }),
      }),
    );
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.field === "browserProofRun.status"),
    ).toBe(true);
  });

  it("rejects verified_local when the run gitSha is not current HEAD", () => {
    const result = validateCompletionEvidence(
      baseRecord(),
      verifiedOptions({
        readBrowserProofRun: () =>
          passedRun({ gitSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
      }),
    );
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.field === "browserProofRun.gitSha"),
    ).toBe(true);
  });

  it("rejects verified_local when only a browser spec path exists", () => {
    const result = validateCompletionEvidence(baseRecord(), {
      pathExists: () => true,
    });
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.field === "browserProofRun"),
    ).toBe(true);
    expect(
      mayMarkPhaseItemComplete(baseRecord(), { pathExists: () => true }),
    ).toBe(false);
  });

  it("rejects missing required evidence fields", () => {
    const incomplete = baseRecord({
      evidence: {
        ...baseRecord().evidence,
        browser: null,
      },
    });
    const result = validateCompletionEvidence(incomplete);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.field === "browser")).toBe(true);
  });

  it("rejects unexplained n_a", () => {
    const result = validateCompletionEvidence(
      baseRecord({
        evidence: {
          ...baseRecord().evidence,
          live_gap: null,
        },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.field === "live_gap")).toBe(
      true,
    );
  });

  it("rejects lying repository paths", () => {
    const result = validateCompletionEvidence(
      baseRecord(),
      verifiedOptions({
        pathExists: (path) =>
          path !== "packages/domain/src/programme/completion-evidence.ts",
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.field === "artifact")).toBe(
      true,
    );
  });

  it("rejects non-executable browser specs", () => {
    const result = validateCompletionEvidence(
      baseRecord({
        browserProofSpec: "docs/evidence/tranches/8.4.json",
      }),
      verifiedOptions(),
    );
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.field === "browserProofSpec"),
    ).toBe(true);
  });

  it("rejects verified status with incomplete UI checklist", () => {
    const result = validateCompletionEvidence(
      baseRecord({
        uiChecklist: {
          ...baseRecord().uiChecklist,
          denied: "missing",
        },
      }),
      verifiedOptions(),
    );
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.field === "uiChecklist.denied"),
    ).toBe(true);
  });

  it("allows implemented_unverified without browser proof run", () => {
    const record = baseRecord({
      status: "implemented_unverified",
      linkedSeedId: "",
      browserProofSpec: "",
      evidence: {
        ...baseRecord().evidence,
        browser: "Foundation only; browser proof deferred",
      },
      applicability: {
        ...baseRecord().applicability,
        browser: "n_a",
      },
    });
    expect(validateCompletionEvidence(record).ok).toBe(true);
    expect(mayMarkPhaseItemComplete(record)).toBe(false);
  });

  it("requires live_gap when blocked_external", () => {
    const result = validateCompletionEvidence(
      baseRecord({
        status: "blocked_external",
        evidence: {
          ...baseRecord().evidence,
          live_gap: null,
        },
        applicability: {
          ...baseRecord().applicability,
          live_gap: "required",
        },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.field === "live_gap")).toBe(
      true,
    );
  });

  it("parses a JSON-shaped record", () => {
    const parsed = parseCompletionEvidenceRecord(baseRecord());
    expect(parsed.phaseItemId).toBe("8.4");
    expect(validateCompletionEvidence(parsed, verifiedOptions()).ok).toBe(true);
  });
});
