/**
 * Machine-readable completion evidence (AUD-001–AUD-005 / PHASE 8.4 /
 * ADR-068). A checked PHASE box means verified with applicable evidence —
 * not merely that scaffolding landed. verified_local also requires a current
 * Playwright run artifact under docs/evidence/runs/ (status=passed).
 */

export const PROGRAMME_STATUS_VALUES = [
  "target",
  "implemented_unverified",
  "verified_local",
  "verified_live",
  "blocked_external",
  "deferred",
  "excluded",
] as const;

export type ProgrammeStatus = (typeof PROGRAMME_STATUS_VALUES)[number];

export const COMPLETION_EVIDENCE_FIELDS = [
  "domain",
  "persistence",
  "service",
  "origin_ui",
  "receiver_ui",
  "rls",
  "exceptions",
  "browser",
  "operations",
  "live_gap",
] as const;

export type CompletionEvidenceField =
  (typeof COMPLETION_EVIDENCE_FIELDS)[number];

export type EvidenceApplicability = "required" | "n_a";

export const UI_STATE_CHECKLIST_KEYS = [
  "loading",
  "empty",
  "error",
  "denied",
  "stale",
  "conflict",
  "success",
  "role_orientation",
  "task_continuation",
  "phone",
  "tablet",
  "desktop",
  "keyboard_a11y",
] as const;

export type UiStateChecklistKey = (typeof UI_STATE_CHECKLIST_KEYS)[number];

export type UiChecklistValue = "proven" | "n_a" | "missing";

export const BROWSER_PROOF_RUN_STATUSES = ["passed", "failed"] as const;

export type BrowserProofRunStatus = (typeof BROWSER_PROOF_RUN_STATUSES)[number];

/** One terse Playwright pass/fail record — no screenshots or device matrix. */
export interface BrowserProofRunArtifact {
  readonly phaseItemId: string;
  readonly gitSha: string;
  readonly spec: string;
  readonly status: BrowserProofRunStatus;
  readonly timestamp: string;
}

export interface CompletionEvidenceRecord {
  readonly phaseItemId: string;
  readonly requirementIds: readonly string[];
  readonly status: ProgrammeStatus;
  readonly title: string;
  readonly applicability: Readonly<
    Record<CompletionEvidenceField, EvidenceApplicability>
  >;
  readonly evidence: Readonly<Record<CompletionEvidenceField, string | null>>;
  readonly uiChecklist: Readonly<Record<UiStateChecklistKey, UiChecklistValue>>;
  readonly linkedSeedId: string;
  readonly browserProofSpec: string;
  readonly assertedAt: string;
}

export interface CompletionEvidenceIssue {
  readonly field: string;
  readonly message: string;
}

export interface CompletionEvidenceValidation {
  readonly ok: boolean;
  readonly issues: readonly CompletionEvidenceIssue[];
}

export interface CompletionEvidenceValidateOptions {
  /**
   * When provided, repo-relative artifact paths mentioned in required
   * evidence / browserProofSpec / run path must exist. Injected for unit tests.
   */
  readonly pathExists?: (relativePath: string) => boolean;
  /** Load docs/evidence/runs/<phaseItemId>.json contents, or null if absent. */
  readonly readBrowserProofRun?: (phaseItemId: string) => unknown | null;
  /** When set, a verified_* claim requires the run artifact gitSha to match. */
  readonly currentGitSha?: string;
}

const VERIFIED_STATUSES: ReadonlySet<ProgrammeStatus> = new Set([
  "verified_local",
  "verified_live",
]);

const REPO_PATH_RE =
  /(?:^|[\s,])((?:packages|apps|docs|scripts|supabase)\/[\w./@+\-()[\]]+\.[\w]+)/g;

export function isProgrammeStatus(value: unknown): value is ProgrammeStatus {
  return (
    typeof value === "string" &&
    (PROGRAMME_STATUS_VALUES as readonly string[]).includes(value)
  );
}

export function browserProofRunPath(phaseItemId: string): string {
  return `docs/evidence/runs/${phaseItemId}.json`;
}

export function buildBrowserProofRunArtifact(args: {
  readonly phaseItemId: string;
  readonly gitSha: string;
  readonly spec: string;
  readonly status: BrowserProofRunStatus;
  readonly timestamp?: string;
}): BrowserProofRunArtifact {
  return {
    phaseItemId: args.phaseItemId,
    gitSha: args.gitSha,
    spec: args.spec,
    status: args.status,
    timestamp: args.timestamp ?? new Date().toISOString(),
  };
}

export function parseBrowserProofRunArtifact(
  value: unknown,
): BrowserProofRunArtifact {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Browser proof run must be an object");
  }
  const record = value as Record<string, unknown>;
  const status = record["status"];
  if (status !== "passed" && status !== "failed") {
    throw new Error(`Invalid browser proof run status ${String(status)}`);
  }
  return {
    phaseItemId: String(record["phaseItemId"] ?? ""),
    gitSha: String(record["gitSha"] ?? ""),
    spec: String(record["spec"] ?? ""),
    status,
    timestamp: String(record["timestamp"] ?? ""),
  };
}

function extractRepoPaths(value: string): string[] {
  const paths: string[] = [];
  for (const match of value.matchAll(REPO_PATH_RE)) {
    const path = match[1];
    if (path) paths.push(path);
  }
  return paths;
}

function isExecutableBrowserSpec(spec: string): boolean {
  return (
    /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(spec) &&
    (spec.startsWith("apps/") || spec.startsWith("packages/"))
  );
}

function specsMatch(artifactSpec: string, expectedSpec: string): boolean {
  const a = artifactSpec.trim();
  const b = expectedSpec.trim();
  return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
}

/**
 * Rejects completion claims when any applicable evidence field is empty,
 * when n_a lacks an explanation, when referenced paths are missing, when the
 * browser spec is not executable, when verified_* lacks seed/browser proof,
 * or when verified_* lacks a current passed Playwright run artifact.
 */
export function validateCompletionEvidence(
  record: CompletionEvidenceRecord,
  options: CompletionEvidenceValidateOptions = {},
): CompletionEvidenceValidation {
  const issues: CompletionEvidenceIssue[] = [];

  if (!record.phaseItemId.trim()) {
    issues.push({
      field: "phaseItemId",
      message: "phaseItemId is required",
    });
  }
  if (record.requirementIds.length === 0) {
    issues.push({
      field: "requirementIds",
      message: "at least one requirement id is required",
    });
  }
  if (!isProgrammeStatus(record.status)) {
    issues.push({
      field: "status",
      message: `unknown status ${String(record.status)}`,
    });
  }

  for (const field of COMPLETION_EVIDENCE_FIELDS) {
    const applicability = record.applicability[field];
    const value = record.evidence[field];
    if (applicability === "required") {
      if (typeof value !== "string" || value.trim().length === 0) {
        issues.push({
          field,
          message: `required evidence field ${field} is missing`,
        });
      }
    } else if (typeof value !== "string" || value.trim().length === 0) {
      issues.push({
        field,
        message: `n_a field ${field} requires an explanatory note`,
      });
    }
  }

  if (VERIFIED_STATUSES.has(record.status)) {
    if (!record.linkedSeedId.trim()) {
      issues.push({
        field: "linkedSeedId",
        message: "verified status requires linkedSeedId",
      });
    }
    if (!record.browserProofSpec.trim()) {
      issues.push({
        field: "browserProofSpec",
        message: "verified status requires browserProofSpec",
      });
    } else if (!isExecutableBrowserSpec(record.browserProofSpec.trim())) {
      issues.push({
        field: "browserProofSpec",
        message:
          "browserProofSpec must be an executable apps/ or packages/ *.spec.ts path",
      });
    }
    for (const key of UI_STATE_CHECKLIST_KEYS) {
      const value = record.uiChecklist[key];
      if (value !== "proven" && value !== "n_a") {
        issues.push({
          field: `uiChecklist.${key}`,
          message: `verified status requires uiChecklist.${key} proven or n_a`,
        });
      }
    }

    const runRelPath = browserProofRunPath(record.phaseItemId);
    if (options.pathExists && !options.pathExists(runRelPath)) {
      issues.push({
        field: "browserProofRun",
        message: `verified status requires passed run artifact at ${runRelPath}`,
      });
    } else if (options.readBrowserProofRun) {
      const raw = options.readBrowserProofRun(record.phaseItemId);
      if (raw === null || raw === undefined) {
        issues.push({
          field: "browserProofRun",
          message: `verified status requires passed run artifact at ${runRelPath}`,
        });
      } else {
        try {
          const run = parseBrowserProofRunArtifact(raw);
          if (run.phaseItemId !== record.phaseItemId) {
            issues.push({
              field: "browserProofRun.phaseItemId",
              message: `run phaseItemId ${run.phaseItemId} does not match ${record.phaseItemId}`,
            });
          }
          if (!specsMatch(run.spec, record.browserProofSpec)) {
            issues.push({
              field: "browserProofRun.spec",
              message: `run spec ${run.spec} does not match browserProofSpec ${record.browserProofSpec}`,
            });
          }
          if (run.status !== "passed") {
            issues.push({
              field: "browserProofRun.status",
              message: `verified status requires run status=passed (got ${run.status})`,
            });
          }
          if (!run.gitSha.trim()) {
            issues.push({
              field: "browserProofRun.gitSha",
              message: "run artifact gitSha is required",
            });
          } else if (
            options.currentGitSha &&
            run.gitSha !== options.currentGitSha
          ) {
            issues.push({
              field: "browserProofRun.gitSha",
              message: `run gitSha ${run.gitSha} is not current HEAD ${options.currentGitSha}`,
            });
          }
          if (!run.timestamp.trim()) {
            issues.push({
              field: "browserProofRun.timestamp",
              message: "run artifact timestamp is required",
            });
          }
        } catch (error) {
          issues.push({
            field: "browserProofRun",
            message:
              error instanceof Error
                ? error.message
                : "failed to parse browser proof run",
          });
        }
      }
    } else {
      issues.push({
        field: "browserProofRun",
        message:
          "verified status requires readBrowserProofRun to validate a passed run artifact",
      });
    }
  }

  if (record.status === "blocked_external") {
    const gap = record.evidence.live_gap;
    if (typeof gap !== "string" || gap.trim().length === 0) {
      issues.push({
        field: "live_gap",
        message: "blocked_external requires a named live_gap",
      });
    }
  }

  if (options.pathExists) {
    const candidates = new Set<string>();
    for (const field of COMPLETION_EVIDENCE_FIELDS) {
      if (record.applicability[field] !== "required") continue;
      const value = record.evidence[field];
      if (typeof value === "string") {
        for (const path of extractRepoPaths(value)) {
          candidates.add(path);
        }
      }
    }
    if (record.browserProofSpec.trim()) {
      candidates.add(record.browserProofSpec.trim());
    }
    for (const path of candidates) {
      if (!options.pathExists(path)) {
        issues.push({
          field: "artifact",
          message: `referenced path does not exist: ${path}`,
        });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

/**
 * True only when status is a verified_* value and evidence validates.
 * Used to gate marking a PHASE item complete.
 */
export function mayMarkPhaseItemComplete(
  record: CompletionEvidenceRecord,
  options: CompletionEvidenceValidateOptions = {},
): boolean {
  if (!VERIFIED_STATUSES.has(record.status)) return false;
  return validateCompletionEvidence(record, options).ok;
}

export function parseCompletionEvidenceRecord(
  value: unknown,
): CompletionEvidenceRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Completion evidence must be an object");
  }
  const record = value as Record<string, unknown>;
  const applicabilityRaw = record["applicability"];
  const evidenceRaw = record["evidence"];
  const uiRaw = record["uiChecklist"];
  if (
    applicabilityRaw === null ||
    typeof applicabilityRaw !== "object" ||
    Array.isArray(applicabilityRaw) ||
    evidenceRaw === null ||
    typeof evidenceRaw !== "object" ||
    Array.isArray(evidenceRaw) ||
    uiRaw === null ||
    typeof uiRaw !== "object" ||
    Array.isArray(uiRaw)
  ) {
    throw new Error("Completion evidence missing applicability/evidence/ui");
  }

  const applicability = {} as Record<
    CompletionEvidenceField,
    EvidenceApplicability
  >;
  const evidence = {} as Record<CompletionEvidenceField, string | null>;
  for (const field of COMPLETION_EVIDENCE_FIELDS) {
    const app = (applicabilityRaw as Record<string, unknown>)[field];
    if (app !== "required" && app !== "n_a") {
      throw new Error(`Invalid applicability for ${field}`);
    }
    applicability[field] = app;
    const ev = (evidenceRaw as Record<string, unknown>)[field];
    evidence[field] = ev === null || ev === undefined ? null : String(ev);
  }

  const uiChecklist = {} as Record<UiStateChecklistKey, UiChecklistValue>;
  for (const key of UI_STATE_CHECKLIST_KEYS) {
    const ui = (uiRaw as Record<string, unknown>)[key];
    if (ui !== "proven" && ui !== "n_a" && ui !== "missing") {
      throw new Error(`Invalid uiChecklist for ${key}`);
    }
    uiChecklist[key] = ui;
  }

  const status = record["status"];
  if (!isProgrammeStatus(status)) {
    throw new Error(`Invalid programme status ${String(status)}`);
  }

  const requirementIds = Array.isArray(record["requirementIds"])
    ? record["requirementIds"].map(String)
    : [];

  return {
    phaseItemId: String(record["phaseItemId"] ?? ""),
    requirementIds,
    status,
    title: String(record["title"] ?? ""),
    applicability,
    evidence,
    uiChecklist,
    linkedSeedId: String(record["linkedSeedId"] ?? ""),
    browserProofSpec: String(record["browserProofSpec"] ?? ""),
    assertedAt: String(record["assertedAt"] ?? ""),
  };
}
