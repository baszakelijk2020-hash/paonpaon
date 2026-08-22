// Single source of truth for the three PAON Vercel projects — the
// project IDs here MUST match .github/workflows/ci.yml's deploy matrix
// and each app's apps/<app>/.vercel/project.json. Keeping one file
// means a future project recreate/rename only needs updating here.

export const TEAM_ID = "team_fDLh0iXJ8upTJTwbAktVdtGc";

export const APPS = {
  customer: {
    projectId: "prj_LZi3NMbuRGmmjpX7oWzeFjbFeFHk",
    projectName: "paonpaon-customer",
    domain: "paonpaon-customer.vercel.app",
    rootDirectory: "apps/customer",
    // A path that must render THIS app's markup and nothing else's.
    identityPath: "/login",
    identityStatus: 200,
    // Strings that MUST appear in identityPath's HTML.
    mustContain: ["Welcome back.", "Private client"],
    // Strings that must NEVER appear — lifted from the other two apps'
    // own UNIQUE chrome (not generic prose that legitimately
    // cross-references another app by name), so a cross-app-content
    // bug fails loudly without false-positiving on normal copy.
    mustNotContain: ["Staff access", "Platform staff"],
    // A route the live storefront must actually serve (public by design).
    publicSmokePath: "/r/atelier-demo",
    publicSmokeMustContain: ["Atelier Demo"],
  },
  retailer: {
    projectId: "prj_z2yJPrlzEyOBhkStN4cf9fCi1bEg",
    projectName: "paonpaon-retailer",
    domain: "paonpaon-retailer.vercel.app",
    rootDirectory: "apps/retailer",
    identityPath: "/login",
    identityStatus: 200,
    mustContain: ["Open the atelier.", "Staff access"],
    mustNotContain: ["Private client", "Platform staff"],
    // Demo-login backdoor regression guard (2026-08-22 incident): this
    // text must NEVER render on a real production build.
    mustNotContainProd: ["Demo login", "DEV ONLY", "QUICK PERSONA LOGIN"],
    // A route that requires a session — unauthenticated GET must bounce
    // to /login, never render dashboard content.
    protectedPath: "/dashboard",
  },
  admin: {
    projectId: "prj_wdpo4BZUignmmufUovwuEWW4xVMO",
    projectName: "paonpaon-admin",
    domain: "paonpaon-admin.vercel.app",
    rootDirectory: "apps/admin",
    identityPath: "/login",
    identityStatus: 200,
    mustContain: ["Platform staff", "Platform administration"],
    mustNotContain: ["Private client", "Staff access"],
    protectedPath: "/retailers",
  },
};

export const APP_NAMES = Object.keys(APPS);

// Paths that must NEVER be gated behind auth — PWA metadata the browser
// fetches before any session exists. Regression guard for the
// manifest.webmanifest-redirects-to-/login incident (2026-08-22).
export const PWA_METADATA_PATHS = ["/manifest.webmanifest", "/icon"];

// Anything under these path prefixes inside a deployment's file
// manifest means a foreign app's build artifacts or repo-wide cruft
// leaked into this deployment.
export function forbiddenPathPrefixes(appName) {
  const others = APP_NAMES.filter((n) => n !== appName);
  return [...others.map((n) => `src/apps/${n}/`), "src/.claude/worktrees/"];
}

// Exact filenames (basename match, anywhere in the tree) that must
// never appear in a deployment's file manifest — real secret files,
// as opposed to committed `.env.example` templates which are fine.
export const FORBIDDEN_EXACT_BASENAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
  ".env.development.local",
]);
