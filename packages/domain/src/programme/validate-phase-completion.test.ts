import { describe, expect, it } from "vitest";

import {
  extractCheckedPhaseItemIds,
  validatePhaseCompletionGate,
} from "./validate-phase-completion";

describe("PHASE completion gate", () => {
  it("extracts checked item ids", () => {
    const markdown = `
- [x] **8.3 Familiarity presets**
- [ ] **8.4 Machine-enforced**
- [x] **7.8 Policy**
`;
    expect(extractCheckedPhaseItemIds(markdown)).toEqual(["8.3", "7.8"]);
  });

  it("grandfathers pre-8.4 checked items without evidence", () => {
    const result = validatePhaseCompletionGate({
      phaseMarkdown: "- [x] **8.3 Familiarity**\n",
      evidenceByPhaseItemId: new Map(),
    });
    expect(result.ok).toBe(true);
    expect(result.gatedIds).toEqual([]);
  });

  it("rejects checked 8.4+ items without evidence", () => {
    const result = validatePhaseCompletionGate({
      phaseMarkdown: "- [x] **8.4 Gate**\n",
      evidenceByPhaseItemId: new Map(),
    });
    expect(result.ok).toBe(false);
    expect(result.missingEvidence).toEqual(["8.4"]);
  });

  it("accepts checked items with verified evidence", () => {
    const evidence = {
      phaseItemId: "8.4",
      requirementIds: ["AUD-001"],
      status: "verified_local",
      title: "Gate",
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
        domain: "d",
        persistence: "p",
        service: "s",
        origin_ui: "o",
        receiver_ui: "r",
        rls: "rls",
        exceptions: "e",
        browser: "apps/retailer/e2e/completion-harness.spec.ts",
        operations: "op",
        live_gap: "No live gap for fixture",
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
      linkedSeedId: "seed",
      browserProofSpec: "apps/retailer/e2e/completion-harness.spec.ts",
      assertedAt: "2026-07-30T00:00:00.000Z",
    };
    const head = "cccccccccccccccccccccccccccccccccccccccc";
    const result = validatePhaseCompletionGate({
      phaseMarkdown: "- [x] **8.4 Gate**\n",
      evidenceByPhaseItemId: new Map([["8.4", evidence]]),
      evidenceOptions: {
        pathExists: () => true,
        currentGitSha: head,
        readBrowserProofRun: () => ({
          phaseItemId: "8.4",
          gitSha: head,
          spec: "apps/retailer/e2e/completion-harness.spec.ts",
          status: "passed",
          timestamp: "2026-07-30T00:00:00.000Z",
        }),
      },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects checked verified items without a passed run artifact", () => {
    const evidence = {
      phaseItemId: "8.4",
      requirementIds: ["AUD-001"],
      status: "verified_local",
      title: "Gate",
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
        domain: "d",
        persistence: "p",
        service: "s",
        origin_ui: "o",
        receiver_ui: "r",
        rls: "rls",
        exceptions: "e",
        browser: "apps/retailer/e2e/completion-harness.spec.ts",
        operations: "op",
        live_gap: "No live gap for fixture",
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
      linkedSeedId: "seed",
      browserProofSpec: "apps/retailer/e2e/completion-harness.spec.ts",
      assertedAt: "2026-07-30T00:00:00.000Z",
    };
    const result = validatePhaseCompletionGate({
      phaseMarkdown: "- [x] **8.4 Gate**\n",
      evidenceByPhaseItemId: new Map([["8.4", evidence]]),
      evidenceOptions: {
        pathExists: () => true,
        readBrowserProofRun: () => null,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.invalidEvidence.map((row) => row.phaseItemId)).toEqual([
      "8.4",
    ]);
  });
});
