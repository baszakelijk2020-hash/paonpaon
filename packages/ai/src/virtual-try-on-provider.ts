/**
 * Provider-neutral virtual try-on port (PHASE 17.10 / ADV-110).
 *
 * Vendor adapters translate these PAON-owned inputs at the package boundary.
 * Customer, retailer, budget, and persistence code must never import a
 * provider SDK type. Authorization happens before any create method is called.
 */

import type { Money } from "@paon/domain";

export interface GenerationAssetReference {
  readonly assetId: string;
  readonly signedUrl: string;
  readonly contentType: string;
}

export interface TryOnInput {
  readonly subject: GenerationAssetReference;
  readonly garments: readonly GenerationAssetReference[];
  readonly environment?: GenerationAssetReference;
  readonly quality: "preview" | "premium";
  readonly aspectRatio: string;
}

export interface AvatarInput {
  readonly references: readonly GenerationAssetReference[];
  readonly environment?: GenerationAssetReference;
  readonly quality: "preview" | "premium";
  readonly aspectRatio: string;
}

export interface EditInput {
  readonly source: GenerationAssetReference;
  readonly instruction: string;
  readonly quality: "preview" | "premium";
}

export interface VideoInput {
  readonly source: GenerationAssetReference;
  readonly durationSeconds: number;
  readonly aspectRatio: string;
}

export type GenerationRequest =
  | { readonly kind: "try_on"; readonly input: TryOnInput }
  | { readonly kind: "avatar"; readonly input: AvatarInput }
  | { readonly kind: "edit"; readonly input: EditInput }
  | { readonly kind: "video"; readonly input: VideoInput };

export const GENERATION_JOB_STATUSES = [
  "queued",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type GenerationJobStatus = (typeof GENERATION_JOB_STATUSES)[number];

export interface GenerationOutput {
  readonly assetUrl: string;
  readonly contentType: string;
}

export interface GenerationJob {
  readonly providerJobId: string;
  readonly provider: string;
  readonly model: string;
  readonly status: GenerationJobStatus;
  readonly createdAt: string;
}

export interface GenerationStatus extends GenerationJob {
  readonly output?: GenerationOutput;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly actualCost?: Money;
  readonly completedAt?: string;
}

export interface VirtualTryOnProvider {
  readonly providerName: string;
  createTryOn(input: TryOnInput): Promise<GenerationJob>;
  createAvatar(input: AvatarInput): Promise<GenerationJob>;
  editImage(input: EditInput): Promise<GenerationJob>;
  createVideo(input: VideoInput): Promise<GenerationJob>;
  getStatus(jobId: string): Promise<GenerationStatus>;
  cancel?(jobId: string): Promise<void>;
  estimateCost(input: GenerationRequest): Promise<Money>;
}
