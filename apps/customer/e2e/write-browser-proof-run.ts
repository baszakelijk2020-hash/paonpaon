/**
 * Writes the single terse Playwright run artifact required for verified_local
 * (phase ID, git SHA, spec, status, timestamp). No screenshots or device matrix.
 */

import { execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  browserProofRunPath,
  buildBrowserProofRunArtifact,
  type BrowserProofRunStatus,
} from "@paon/domain";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function gitSha(): string {
  return execSync("git rev-parse HEAD", {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

export async function writeBrowserProofRun(args: {
  readonly phaseItemId: string;
  readonly spec: string;
  readonly status: BrowserProofRunStatus;
}): Promise<string> {
  const artifact = buildBrowserProofRunArtifact({
    phaseItemId: args.phaseItemId,
    gitSha: gitSha(),
    spec: args.spec,
    status: args.status,
  });
  const relative = browserProofRunPath(args.phaseItemId);
  const absolute = path.join(repoRoot, relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(artifact, null, 2)}\n`, {
    encoding: "utf8",
  });
  return relative;
}
