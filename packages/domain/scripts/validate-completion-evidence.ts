/**
 * ADR-068 / PHASE 8.4 completion gate.
 * Validates docs/evidence/tranches/*.json and checked PHASE items from 8.4+.
 *
 * Run: pnpm validate:completion
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseCompletionEvidenceRecord,
  validateCompletionEvidence,
} from "../src/programme/completion-evidence.ts";
import { validatePhaseCompletionGate } from "../src/programme/validate-phase-completion.ts";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const evidenceDir = path.join(root, "docs/evidence/tranches");
const phasePath = path.join(root, "docs/PHASE.md");

function pathExists(relativePath: string): boolean {
  return existsSync(path.join(root, relativePath));
}

async function main(): Promise<void> {
  const phaseMarkdown = await readFile(phasePath, "utf8");
  const files = (await readdir(evidenceDir)).filter((name) =>
    name.endsWith(".json"),
  );
  const evidenceByPhaseItemId = new Map<string, unknown>();
  let failed = false;

  for (const file of files) {
    const raw: unknown = JSON.parse(
      await readFile(path.join(evidenceDir, file), "utf8"),
    );
    const record = parseCompletionEvidenceRecord(raw);
    const validation = validateCompletionEvidence(record, { pathExists });
    if (!validation.ok) {
      failed = true;
      console.error(`Invalid evidence ${file}:`);
      for (const issue of validation.issues) {
        console.error(`  - ${issue.field}: ${issue.message}`);
      }
    }
    evidenceByPhaseItemId.set(record.phaseItemId, raw);
  }

  const gate = validatePhaseCompletionGate({
    phaseMarkdown,
    evidenceByPhaseItemId,
  });
  if (!gate.ok) {
    failed = true;
    if (gate.missingEvidence.length > 0) {
      console.error(
        `Checked PHASE items missing evidence: ${gate.missingEvidence.join(", ")}`,
      );
    }
    for (const invalid of gate.invalidEvidence) {
      console.error(
        `Invalid evidence for ${invalid.phaseItemId}: ${invalid.issues.join("; ")}`,
      );
    }
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.warn(
    `Completion evidence OK (${files.length} tranche file(s); gated checked ids: ${gate.gatedIds.join(", ") || "none"})`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
