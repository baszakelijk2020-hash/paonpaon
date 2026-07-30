/**
 * Validates that every checked PHASE.md item that requires ADR-068 evidence
 * has a verified evidence record under docs/evidence/tranches/. Historical
 * Stages 0–8.3 remain grandfathered (AUD non-goal: no retroactive browser
 * claim). Stage 8.4 and every later checked item must pass the gate.
 */

import {
  mayMarkPhaseItemComplete,
  parseCompletionEvidenceRecord,
  type CompletionEvidenceRecord,
} from "./completion-evidence";

const CHECKED_ITEM_RE = /^- \[x\] \*\*(\d+(?:\.\d+)*)\b/gm;

export function extractCheckedPhaseItemIds(phaseMarkdown: string): string[] {
  const ids: string[] = [];
  for (const match of phaseMarkdown.matchAll(CHECKED_ITEM_RE)) {
    const id = match[1];
    if (id) ids.push(id);
  }
  return ids;
}

/**
 * Evidence is mandatory from Stage 8.4 onward (ADR-068). Earlier checked
 * items are grandfathered and not retroactively invalidated.
 */
export function requiresCompletionEvidence(phaseItemId: string): boolean {
  const [majorRaw, minorRaw] = phaseItemId.split(".");
  const major = Number(majorRaw);
  const minor = minorRaw === undefined ? 0 : Number(minorRaw);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return true;
  if (major > 8) return true;
  if (major === 8 && minor >= 4) return true;
  return false;
}

export interface PhaseCompletionGateResult {
  readonly ok: boolean;
  readonly checkedIds: readonly string[];
  readonly gatedIds: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly invalidEvidence: readonly {
    readonly phaseItemId: string;
    readonly issues: readonly string[];
  }[];
}

/**
 * Gate: every checked PHASE id that requires evidence must have a parseable
 * record that mayMarkPhaseItemComplete accepts.
 */
export function validatePhaseCompletionGate(args: {
  readonly phaseMarkdown: string;
  readonly evidenceByPhaseItemId: ReadonlyMap<string, unknown>;
}): PhaseCompletionGateResult {
  const checkedIds = extractCheckedPhaseItemIds(args.phaseMarkdown);
  const gatedIds = checkedIds.filter(requiresCompletionEvidence);
  const missingEvidence: string[] = [];
  const invalidEvidence: {
    phaseItemId: string;
    issues: string[];
  }[] = [];

  for (const id of gatedIds) {
    const raw = args.evidenceByPhaseItemId.get(id);
    if (raw === undefined) {
      missingEvidence.push(id);
      continue;
    }
    let record: CompletionEvidenceRecord;
    try {
      record = parseCompletionEvidenceRecord(raw);
    } catch (error) {
      invalidEvidence.push({
        phaseItemId: id,
        issues: [
          error instanceof Error ? error.message : "failed to parse evidence",
        ],
      });
      continue;
    }
    if (record.phaseItemId !== id) {
      invalidEvidence.push({
        phaseItemId: id,
        issues: [
          `evidence phaseItemId ${record.phaseItemId} does not match ${id}`,
        ],
      });
      continue;
    }
    if (!mayMarkPhaseItemComplete(record)) {
      invalidEvidence.push({
        phaseItemId: id,
        issues: [`status ${record.status} is not a verified completion claim`],
      });
    }
  }

  return {
    ok: missingEvidence.length === 0 && invalidEvidence.length === 0,
    checkedIds,
    gatedIds,
    missingEvidence,
    invalidEvidence,
  };
}
