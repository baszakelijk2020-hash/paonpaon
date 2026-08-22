#!/usr/bin/env node
// Permanent production release gate — `pnpm test:production`.
//
// Verifies, against the ACTUAL live production deployments (not
// localhost), that each of the three apps is what it claims to be:
// SOURCE -> BUILD -> VERCEL DEPLOYMENT -> DOMAIN -> LIVE BROWSER.
//
// Built after the 2026-08-22 incident where manual `vercel deploy
// --prebuilt` runs from the monorepo root uploaded the whole repo tree
// (including other apps' stale .next output) and Vercel's build picked
// the wrong app's compiled pages for two of three production domains.
// Every check below exists because of a concrete failure mode observed
// that day. Exits non-zero if any check fails.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  APPS,
  APP_NAMES,
  TEAM_ID,
  forbiddenPathPrefixes,
  FORBIDDEN_EXACT_BASENAMES,
  PWA_METADATA_PATHS,
} from "./apps.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const VERCEL_TOKEN = process.env.VERCEL_TOKEN || readLocalCliToken();
const TEAM = process.env.VERCEL_TEAM_ID || TEAM_ID;

let failures = 0;
let warnings = 0;

function ok(label) {
  console.log(`  \x1b[32m✓\x1b[0m ${label}`);
}
function fail(label, detail) {
  failures += 1;
  console.log(`  \x1b[31m✗ FAIL\x1b[0m ${label}`);
  if (detail) console.log(`      ${detail}`);
}
function warn(label, detail) {
  warnings += 1;
  console.log(`  \x1b[33m⚠ WARN\x1b[0m ${label}`);
  if (detail) console.log(`      ${detail}`);
}

function readLocalCliToken() {
  const p = path.join(
    process.env.HOME || "",
    "Library/Application Support/com.vercel.cli/auth.json",
  );
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, "utf8")).token;
  } catch {
    return undefined;
  }
}

async function vercelApi(pathname) {
  const sep = pathname.includes("?") ? "&" : "?";
  const url = `https://api.vercel.com${pathname}${sep}teamId=${TEAM}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Vercel API ${pathname} -> HTTP ${res.status}`);
  }
  return res.json();
}

function collectFilePaths(node, prefix = "") {
  const name = node.name ?? "";
  const p = prefix ? `${prefix}/${name}` : name;
  if (node.type === "directory") {
    return (node.children ?? []).flatMap((c) => collectFilePaths(c, p));
  }
  return [p];
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "manual" });
  const text = await res.text().catch(() => "");
  return { status: res.status, headers: res.headers, text };
}

async function checkApp(appName) {
  const cfg = APPS[appName];
  console.log(`\n\x1b[1m${appName.toUpperCase()}\x1b[0m  (${cfg.domain})`);

  // 1 + 14: correct Vercel project + rootDirectory.
  let project;
  try {
    project = await vercelApi(`/v9/projects/${cfg.projectId}`);
    if (project.id !== cfg.projectId) {
      fail(
        "Vercel project id mismatch",
        `expected ${cfg.projectId}, got ${project.id}`,
      );
    } else {
      ok(`Vercel project resolves: ${project.name} (${project.id})`);
    }
    if (project.rootDirectory !== cfg.rootDirectory) {
      fail(
        "rootDirectory misconfigured",
        `expected "${cfg.rootDirectory}", Vercel has "${project.rootDirectory}"`,
      );
    } else {
      ok(`rootDirectory = ${project.rootDirectory}`);
    }
  } catch (e) {
    fail("Could not fetch project from Vercel API", String(e.message ?? e));
    return; // nothing else is checkable without the project
  }

  // 15: domain is assigned to this project, and only this project.
  try {
    const domains = await vercelApi(`/v9/projects/${cfg.projectId}/domains`);
    const match = (domains.domains ?? []).find((d) => d.name === cfg.domain);
    if (!match) {
      fail(`Domain ${cfg.domain} not assigned to project ${cfg.projectId}`);
    } else if (match.redirect) {
      fail(
        `Domain ${cfg.domain} has an unexpected redirect configured`,
        match.redirect,
      );
    } else {
      ok(`Domain ${cfg.domain} owned exclusively by this project`);
    }
  } catch (e) {
    fail("Could not fetch domains from Vercel API", String(e.message ?? e));
  }

  // Production deployment: exists, READY, aliased correctly.
  let deployment;
  try {
    const targets = project.targets || {};
    const prodId = targets.production?.id;
    if (!prodId) {
      fail("No production deployment recorded for this project");
    } else {
      deployment = await vercelApi(`/v13/deployments/${prodId}`);
      if (deployment.readyState !== "READY") {
        fail(`Production deployment is ${deployment.readyState}, not READY`);
      } else {
        ok(`Production deployment READY (${deployment.id})`);
      }
      const alias = deployment.alias || [];
      if (!alias.includes(cfg.domain)) {
        fail(
          `Production deployment is not aliased to ${cfg.domain}`,
          `alias=${alias.join(", ")}`,
        );
      } else {
        ok(`Aliased to ${cfg.domain}`);
      }
    }
  } catch (e) {
    fail("Could not fetch production deployment", String(e.message ?? e));
  }

  // 2 + 3 + 4 + 12: deployment file manifest must contain ONLY this
  // app — no other app's build, no secrets, no repo cruft.
  if (deployment) {
    try {
      const filesRes = await vercelApi(
        `/v6/deployments/${deployment.id}/files`,
      );
      const root = Array.isArray(filesRes) ? filesRes[0] : filesRes;
      const allPaths = collectFilePaths(root);
      const forbidden = forbiddenPathPrefixes(appName);
      const prefixHits = allPaths.filter((p) =>
        forbidden.some((f) => p.startsWith(f)),
      );
      const secretHits = allPaths.filter((p) =>
        FORBIDDEN_EXACT_BASENAMES.has(p.split("/").pop() ?? ""),
      );
      const hits = [...prefixHits, ...secretHits];
      if (hits.length) {
        fail(
          `Deployment contains ${hits.length} file(s) that belong to another app or are real secret files`,
          hits.slice(0, 8).join("\n      "),
        );
      } else {
        ok(
          `File manifest clean — ${allPaths.length} files, no foreign app / secret / cruft paths`,
        );
      }
      const bigPngs = allPaths.filter(
        (p) => /\.(png|jpe?g)$/i.test(p) && !p.includes(`apps/${appName}/`),
      );
      if (bigPngs.length) {
        warn(
          `${bigPngs.length} image file(s) outside apps/${appName}/ present in deployment`,
          bigPngs.slice(0, 5).join(", "),
        );
      }
    } catch (e) {
      fail("Could not fetch deployment file manifest", String(e.message ?? e));
    }
  }

  // 5 + 6: live identity check — the actual bug class this gate exists
  // to prevent. Fetch the real production domain, not the deployment.
  try {
    const { status, text } = await fetchText(
      `https://${cfg.domain}${cfg.identityPath}?_gate=${Date.now()}`,
    );
    if (status !== cfg.identityStatus) {
      fail(
        `GET ${cfg.identityPath} returned ${status}, expected ${cfg.identityStatus}`,
      );
    } else {
      ok(`GET ${cfg.identityPath} -> ${status}`);
    }
    for (const marker of cfg.mustContain) {
      if (!text.includes(marker)) {
        fail(
          `Missing expected identity marker "${marker}"`,
          `on https://${cfg.domain}${cfg.identityPath}`,
        );
      }
    }
    if (cfg.mustContain.every((m) => text.includes(m))) {
      ok(`All identity markers present: ${cfg.mustContain.join(", ")}`);
    }
    for (const marker of cfg.mustNotContain) {
      if (text.includes(marker)) {
        fail(
          `Found ANOTHER APP's marker "${marker}" on ${cfg.domain}${cfg.identityPath}`,
          "this is exactly the cross-app-content bug this gate exists to catch",
        );
      }
    }
    if (cfg.mustNotContain.every((m) => !text.includes(m))) {
      ok("No foreign-app markers present");
    }
    if (cfg.mustNotContainProd) {
      for (const marker of cfg.mustNotContainProd) {
        if (text.includes(marker)) {
          fail(
            `Demo/dev-only content "${marker}" is live in production`,
            "security regression",
          );
        }
      }
      if (cfg.mustNotContainProd.every((m) => !text.includes(m))) {
        ok("No demo/dev-only backdoor content in production build");
      }
    }
  } catch (e) {
    fail(
      `Could not fetch https://${cfg.domain}${cfg.identityPath}`,
      String(e.message ?? e),
    );
  }

  // Public smoke path (customer storefront only).
  if (cfg.publicSmokePath) {
    try {
      const { status, text } = await fetchText(
        `https://${cfg.domain}${cfg.publicSmokePath}?_gate=${Date.now()}`,
      );
      if (status !== 200) {
        fail(`GET ${cfg.publicSmokePath} returned ${status}, expected 200`);
      } else if (!cfg.publicSmokeMustContain.every((m) => text.includes(m))) {
        fail(
          `GET ${cfg.publicSmokePath} missing expected content`,
          cfg.publicSmokeMustContain.join(", "),
        );
      } else {
        ok(`Public storefront smoke path ${cfg.publicSmokePath} OK`);
      }
    } catch (e) {
      fail(`Could not fetch ${cfg.publicSmokePath}`, String(e.message ?? e));
    }
  }

  // 7 + 8 + 9 (partial, unauthenticated boundary): a protected route
  // must NEVER render its dashboard for a signed-out request.
  if (cfg.protectedPath) {
    try {
      const { status, headers, text } = await fetchText(
        `https://${cfg.domain}${cfg.protectedPath}?_gate=${Date.now()}`,
      );
      const location = headers.get("location") || "";
      const isRedirectToLogin =
        [301, 302, 307, 308].includes(status) && location.includes("login");
      if (!isRedirectToLogin) {
        fail(
          `Unauthenticated GET ${cfg.protectedPath} did not bounce to /login`,
          `status=${status} location=${location || "(none)"}`,
        );
      } else {
        ok(
          `Unauthenticated GET ${cfg.protectedPath} correctly redirects to login`,
        );
      }
      if (status === 200 || (text && text.length > 500 && !isRedirectToLogin)) {
        fail(
          `Unauthenticated GET ${cfg.protectedPath} may have rendered real content`,
          `status=${status}`,
        );
      }
    } catch (e) {
      fail(`Could not fetch ${cfg.protectedPath}`, String(e.message ?? e));
    }
  }

  // Regression guard: PWA metadata must never be gated behind auth.
  for (const p of PWA_METADATA_PATHS) {
    try {
      const { status } = await fetchText(`https://${cfg.domain}${p}`);
      if (status >= 300 && status < 400) {
        fail(
          `${p} is redirected (likely gated behind auth middleware)`,
          `status=${status}`,
        );
      } else if (status >= 200 && status < 300) {
        ok(`${p} reachable without auth (${status})`);
      } else {
        warn(`${p} returned unexpected status ${status}`);
      }
    } catch (e) {
      warn(`Could not fetch ${p}`, String(e.message ?? e));
    }
  }
}

async function checkLocalRepoConfig() {
  console.log(`\n\x1b[1mLOCAL REPO CONFIGURATION\x1b[0m`);
  for (const appName of APP_NAMES) {
    const cfg = APPS[appName];
    const projectJsonPath = path.join(
      REPO_ROOT,
      cfg.rootDirectory,
      ".vercel",
      "project.json",
    );
    if (!existsSync(projectJsonPath)) {
      warn(
        `${appName}: no local .vercel/project.json at ${cfg.rootDirectory}`,
        "run `vercel link` there before manual deploys",
      );
      continue;
    }
    const local = JSON.parse(readFileSync(projectJsonPath, "utf8"));
    if (local.projectId !== cfg.projectId) {
      fail(
        `${appName}: local .vercel/project.json links the WRONG project`,
        `local=${local.projectId} expected=${cfg.projectId}`,
      );
    } else {
      ok(`${appName}: local project link matches (${local.projectId})`);
    }
    if (local.settings?.rootDirectory !== cfg.rootDirectory) {
      fail(
        `${appName}: local project.json rootDirectory mismatch`,
        `local=${local.settings?.rootDirectory} expected=${cfg.rootDirectory}`,
      );
    }
  }

  const vercelignorePath = path.join(REPO_ROOT, ".vercelignore");
  if (!existsSync(vercelignorePath)) {
    fail(
      ".vercelignore is missing at repo root",
      "manual deploys from repo root will upload the entire monorepo",
    );
  } else {
    const lines = readFileSync(vercelignorePath, "utf8")
      .split("\n")
      .map((l) => l.trim());
    const required = [".claude/worktrees", "node_modules", ".next"];
    const missing = required.filter((r) => !lines.includes(r));
    if (missing.length) {
      fail(".vercelignore is missing required exclusions", missing.join(", "));
    } else {
      ok(".vercelignore excludes worktrees/node_modules/.next");
    }
  }
}

async function main() {
  if (!VERCEL_TOKEN) {
    console.error(
      "No Vercel token available. Set VERCEL_TOKEN (CI) or run `vercel login` locally.",
    );
    process.exit(1);
  }

  console.log("PAON production release gate\n" + "=".repeat(60));

  await checkLocalRepoConfig();
  for (const appName of APP_NAMES) {
    await checkApp(appName);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`${failures} failure(s), ${warnings} warning(s)`);
  if (failures > 0) {
    console.log("\x1b[31mPRODUCTION GATE: FAILED\x1b[0m");
    process.exit(1);
  }
  console.log("\x1b[32mPRODUCTION GATE: PASSED\x1b[0m");
}

main().catch((e) => {
  console.error("Gate crashed:", e);
  process.exit(1);
});
