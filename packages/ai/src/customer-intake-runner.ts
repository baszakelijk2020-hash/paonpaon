/**
 * Provider-neutral customer intake extraction (PHASE 17.11 — self-
 * provided raw text -> proposed CustomerFact drafts). Domain validation
 * of each proposal (`checkCustomerIntakeProposal`) and persistence
 * happen outside this package, same split as `advisor-capture-runner.ts`.
 */

import type { AIProvider, CustomerIntakeContext } from "./provider";

export interface CustomerIntakeJobOptions {
  readonly maxAttempts?: number;
}

export interface CustomerIntakeJobSuccess {
  readonly ok: true;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly rawOutput: unknown;
}

export interface CustomerIntakeJobFailure {
  readonly ok: false;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly errorMessage: string;
}

export type CustomerIntakeJobResult =
  CustomerIntakeJobSuccess | CustomerIntakeJobFailure;

/** Runs one extraction with bounded retries for transient provider
 * failures. Fails closed (returns a normal failure result, never throws)
 * when the given provider does not implement the optional
 * extractCustomerIntakeFacts capability. */
export async function runCustomerIntakeJob(
  provider: AIProvider,
  context: CustomerIntakeContext,
  options: CustomerIntakeJobOptions = {},
): Promise<CustomerIntakeJobResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const started = Date.now();

  if (!provider.extractCustomerIntakeFacts) {
    return {
      ok: false,
      provider: provider.providerName,
      model: provider.model,
      latencyMs: Date.now() - started,
      attempts: 0,
      errorMessage: "Provider does not support customer intake extraction",
    };
  }

  let attempts = 0;
  let lastError = "Customer intake extraction failed";

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const rawOutput = await provider.extractCustomerIntakeFacts(context);
      return {
        ok: true,
        provider: provider.providerName,
        model: provider.model,
        latencyMs: Date.now() - started,
        attempts,
        rawOutput,
      };
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "Customer intake extraction failed";
    }
  }

  return {
    ok: false,
    provider: provider.providerName,
    model: provider.model,
    latencyMs: Date.now() - started,
    attempts,
    errorMessage: lastError,
  };
}
