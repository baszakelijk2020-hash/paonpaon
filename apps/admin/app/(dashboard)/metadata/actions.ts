"use server";

import { requirePlatformOperator } from "@paon/auth";
import { MetadataRepository } from "@paon/database";
import {
  asId,
  createMetadataConceptInputSchema,
  updateMetadataConceptInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CanonicalMetadataFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
  saved?: boolean;
}

function fieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    errors[key] ??= issue.message;
  }
  return errors;
}

function parseAttributes(value: string | undefined): unknown {
  if (!value?.trim()) {
    return {};
  }
  return JSON.parse(value) as unknown;
}

export async function createCanonicalConcept(
  _previous: CanonicalMetadataFormState,
  formData: FormData,
): Promise<CanonicalMetadataFormState> {
  requirePlatformOperator(await getSession());
  const values = Object.fromEntries(formData.entries()) as Record<
    string,
    string
  >;

  let attributes: unknown;
  try {
    attributes = parseAttributes(values["attributes"]);
  } catch {
    return {
      values,
      fieldErrors: { attributes: "Enter a valid JSON object." },
    };
  }

  const parsed = createMetadataConceptInputSchema.safeParse({
    retailerId: null,
    kind: values["kind"],
    slug: values["slug"],
    canonicalName: values["canonicalName"],
    attributes,
    imageUrl: values["imageUrl"] || undefined,
    active: true,
  });
  if (!parsed.success) {
    return {
      values,
      fieldErrors: fieldErrors(parsed.error.issues),
    };
  }

  try {
    await new MetadataRepository(await getSupabaseServerClient()).createConcept(
      {
        retailerId: null,
        kind: parsed.data.kind,
        slug: parsed.data.slug,
        canonicalName: parsed.data.canonicalName,
        attributes: parsed.data.attributes,
        ...(parsed.data.imageUrl === undefined
          ? {}
          : { imageUrl: parsed.data.imageUrl }),
        active: true,
      },
    );
  } catch (error) {
    return {
      values,
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "The canonical concept could not be created.",
    };
  }

  revalidatePath("/metadata");
  return { values: {}, fieldErrors: {}, saved: true };
}

export async function updateCanonicalConcept(
  _previous: CanonicalMetadataFormState,
  formData: FormData,
): Promise<CanonicalMetadataFormState> {
  requirePlatformOperator(await getSession());
  const values = Object.fromEntries(formData.entries()) as Record<
    string,
    string
  >;

  let attributes: unknown;
  try {
    attributes = parseAttributes(values["attributes"]);
  } catch {
    return {
      values,
      fieldErrors: { attributes: "Enter a valid JSON object." },
    };
  }

  const parsed = updateMetadataConceptInputSchema.safeParse({
    conceptId: values["conceptId"],
    canonicalName: values["canonicalName"],
    attributes,
    imageUrl: values["imageUrl"] || undefined,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return {
      values,
      fieldErrors: fieldErrors(parsed.error.issues),
    };
  }

  try {
    await new MetadataRepository(
      await getSupabaseServerClient(),
    ).updateCanonicalConcept(asId<"MetadataConceptId">(parsed.data.conceptId), {
      canonicalName: parsed.data.canonicalName,
      attributes: parsed.data.attributes,
      ...(parsed.data.imageUrl === undefined
        ? {}
        : { imageUrl: parsed.data.imageUrl }),
      active: parsed.data.active,
    });
  } catch (error) {
    return {
      values,
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "The canonical concept could not be updated.",
    };
  }

  revalidatePath("/metadata");
  return { values: {}, fieldErrors: {}, saved: true };
}
