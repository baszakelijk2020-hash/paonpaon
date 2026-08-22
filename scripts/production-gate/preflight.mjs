#!/usr/bin/env node
// Deployment preflight — run BEFORE any manual `vercel deploy` for one
// app. Blocks the deploy (exit 1) if the working tree is in a state
// that caused the 2026-08-22 cross-app-contamination incident.
//
// Usage: node scripts/production-gate/preflight.mjs <customer|retailer|admin>

import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { APPS, APP_NAMES } from "./apps.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const appName = process.argv[2];
if (!appName || !APPS[appName]) {
  console.error(
    `Usage: node scripts/production-gate/preflight.mjs <${APP_NAMES.join("|")}>`,
  );
  process.exit(1);
}
const cfg = APPS[appName];
const others = APP_NAMES.filter((n) => n !== appName);

let failures = 0;
function ok(m) {
  console.log(`  \x1b[32m✓\x1b[0m ${m}`);
}
function fail(m, d) {
  failures += 1;
  console.log(`  \x1b[31m✗ BLOCKED\x1b[0m ${m}`);
  if (d) console.log(`      ${d}`);
}

console.log(`Deploy preflight: ${appName}\n${"=".repeat(50)}`);

// 1. Other apps' build artifacts must not be present — they get
// swept into the upload when deploying from the monorepo root.
for (const other of others) {
  const otherNext = path.join(REPO_ROOT, APPS[other].rootDirectory, ".next");
  const otherOutput = path.join(
    REPO_ROOT,
    APPS[other].rootDirectory,
    ".vercel",
    "output",
  );
  if (existsSync(otherNext)) {
    fail(
      `${APPS[other].rootDirectory}/.next exists`,
      "remove it before deploying — a monorepo-root deploy will upload it and Vercel may build from it instead of this app",
    );
  }
  if (existsSync(otherOutput)) {
    fail(
      `${APPS[other].rootDirectory}/.vercel/output exists`,
      "remove it before deploying",
    );
  }
}
if (failures === 0)
  ok(`No foreign build artifacts from ${others.join(", ")} present`);

// 2. .env files must not be sitting anywhere they'd get uploaded.
const envCandidates = [
  path.join(REPO_ROOT, ".env"),
  path.join(REPO_ROOT, ".env.local"),
  path.join(REPO_ROOT, ".env.production"),
];
const vercelignorePath = path.join(REPO_ROOT, ".vercelignore");
const ignoreLines = existsSync(vercelignorePath)
  ? readFileSync(vercelignorePath, "utf8")
      .split("\n")
      .map((l) => l.trim())
  : [];
for (const f of envCandidates) {
  if (existsSync(f)) {
    const rel = path.relative(REPO_ROOT, f);
    const ignored = ignoreLines.some(
      (l) =>
        l && (l === rel || (l.endsWith("*") && rel.startsWith(l.slice(0, -1)))),
    );
    if (!ignored && !ignoreLines.includes(".env")) {
      fail(
        `${rel} exists and is not covered by .vercelignore`,
        "add it to .vercelignore or remove it before deploying",
      );
    }
  }
}
if (!failures) ok("No unignored .env files at repo root");

// 3. .claude/worktrees must be excluded — 43GB blew the upload limit
// in the 2026-08-22 incident.
if (existsSync(path.join(REPO_ROOT, ".claude", "worktrees"))) {
  if (!ignoreLines.includes(".claude/worktrees")) {
    fail(
      ".claude/worktrees exists and is NOT in .vercelignore",
      "add `.claude/worktrees` to .vercelignore before deploying",
    );
  } else {
    ok(".claude/worktrees present but correctly excluded via .vercelignore");
  }
}

// 4. Unintended large files at repo root (screenshots etc).
try {
  const rootEntries = readdirSync(REPO_ROOT, { withFileTypes: true });
  const bigLoose = rootEntries
    .filter((e) => e.isFile() && /\.(png|jpe?g|gif|zip|tar|gz)$/i.test(e.name))
    .map((e) => ({
      name: e.name,
      size: statSync(path.join(REPO_ROOT, e.name)).size,
    }))
    .filter((f) => f.size > 100 * 1024);
  const uncovered = bigLoose.filter(
    (f) =>
      !ignoreLines.includes(f.name) &&
      !ignoreLines.includes("*.png") &&
      !ignoreLines.includes("*.jpg"),
  );
  if (uncovered.length) {
    fail(
      `${uncovered.length} large loose file(s) at repo root not covered by .vercelignore`,
      uncovered
        .map((f) => `${f.name} (${Math.round(f.size / 1024)}KB)`)
        .join(", "),
    );
  } else if (bigLoose.length) {
    ok(
      `${bigLoose.length} large loose file(s) present but excluded via .vercelignore`,
    );
  } else {
    ok("No unintended large loose files at repo root");
  }
} catch (e) {
  console.log(`  (could not scan repo root: ${e.message})`);
}

// 5. .vercelignore must exclude the OTHER two apps for this deploy —
// this is the exact rule that was violated for retailer/admin on
// 2026-08-22 (ignore file only ever excluded two of three apps, and
// never the one actually being deployed's siblings correctly).
const missingIgnores = others.filter((o) => !ignoreLines.includes(`apps/${o}`));
if (missingIgnores.length) {
  fail(
    `.vercelignore does not exclude ${missingIgnores.map((o) => `apps/${o}`).join(", ")}`,
    `deploying ${appName} requires excluding: ${others.map((o) => `apps/${o}`).join(", ")}`,
  );
} else {
  ok(`.vercelignore excludes ${others.map((o) => `apps/${o}`).join(", ")}`);
}
if (ignoreLines.includes(`apps/${appName}`)) {
  fail(
    `.vercelignore excludes apps/${appName} itself`,
    "this app would deploy empty",
  );
}

// 6. Correct Vercel project linked for this app's directory.
const projectJsonPath = path.join(
  REPO_ROOT,
  cfg.rootDirectory,
  ".vercel",
  "project.json",
);
if (!existsSync(projectJsonPath)) {
  fail(
    `No .vercel/project.json in ${cfg.rootDirectory}`,
    `run: cd ${cfg.rootDirectory} && vercel link --project ${cfg.projectName}`,
  );
} else {
  const local = JSON.parse(readFileSync(projectJsonPath, "utf8"));
  if (local.projectId !== cfg.projectId) {
    fail(
      `${cfg.rootDirectory}/.vercel/project.json links the WRONG project`,
      `local=${local.projectId} expected=${cfg.projectId}`,
    );
  } else {
    ok(`${cfg.rootDirectory} linked to correct project (${local.projectId})`);
  }
  if (local.settings?.rootDirectory !== cfg.rootDirectory) {
    fail(
      "rootDirectory mismatch in local project.json",
      `local=${local.settings?.rootDirectory} expected=${cfg.rootDirectory}`,
    );
  }
}

// 7. Root-level .vercel/project.json (used for the root-cwd deploy
// trick) must currently point at THIS app, not a leftover from a
// previous app's deploy.
const rootProjectJsonPath = path.join(REPO_ROOT, ".vercel", "project.json");
if (existsSync(rootProjectJsonPath)) {
  const rootLocal = JSON.parse(readFileSync(rootProjectJsonPath, "utf8"));
  if (rootLocal.projectId !== cfg.projectId) {
    fail(
      "repo-root .vercel/project.json points at a DIFFERENT app",
      `root links ${rootLocal.projectId} (${rootLocal.projectName}), expected ${cfg.projectId} (${cfg.projectName}) — this is exactly how the 2026-08-22 mixup happened`,
    );
  } else {
    ok(`repo-root .vercel/project.json points at ${cfg.projectName}`);
  }
}

console.log("\n" + "=".repeat(50));
if (failures > 0) {
  console.log(
    `\x1b[31m${failures} check(s) BLOCKED this deploy.\x1b[0m Fix them and re-run.`,
  );
  process.exit(1);
}
console.log("\x1b[32mPreflight passed.\x1b[0m Safe to deploy " + appName + ".");
