/**
 * ADR-068 / PHASE 8.4 completion gate.
 * Validates docs/evidence/tranches/*.json and checked PHASE items from 8.4+.
 * verified_* claims also require docs/evidence/runs/<id>.json with
 * status=passed for the current git SHA.
 *
 * Run: pnpm validate:completion
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  browserProofRunPath,
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

function currentGitSha(): string {
  return execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
}

const EVIDENCE_ONLY_PATH_RE =
  /^(docs\/evidence\/|docs\/PHASE\.md$|docs\/evidence\/STAGE_REPAIR_LEDGER\.md$)/;

function isCurrentGitSha(artifactGitSha: string): boolean {
  const head = currentGitSha();
  if (artifactGitSha === head) return true;
  try {
    execSync(`git merge-base --is-ancestor ${artifactGitSha} HEAD`, {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    return false;
  }
  const changed = execSync(`git diff --name-only ${artifactGitSha} HEAD`, {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  if (changed.length === 0) return true;
  return changed.every((file) => EVIDENCE_ONLY_PATH_RE.test(file));
}

function readBrowserProofRun(phaseItemId: string): unknown | null {
  const absolute = path.join(root, browserProofRunPath(phaseItemId));
  if (!existsSync(absolute)) return null;
  return JSON.parse(readFileSync(absolute, "utf8")) as unknown;
}

async function main(): Promise<void> {
  const phaseMarkdown = await readFile(phasePath, "utf8");
  const files = (await readdir(evidenceDir)).filter((name) =>
    name.endsWith(".json"),
  );
  const evidenceByPhaseItemId = new Map<string, unknown>();
  const gitSha = currentGitSha();
  const evidenceOptions = {
    pathExists,
    readBrowserProofRun,
    isCurrentGitSha,
  };
  let failed = false;

  for (const file of files) {
    const raw: unknown = JSON.parse(
      await readFile(path.join(evidenceDir, file), "utf8"),
    );
    const record = parseCompletionEvidenceRecord(raw);
    const validation = validateCompletionEvidence(record, evidenceOptions);
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
    evidenceOptions,
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
    `Completion evidence OK (${files.length} tranche file(s); gated checked ids: ${gate.gatedIds.join(", ") || "none"}; HEAD ${gitSha.slice(0, 7)})`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
