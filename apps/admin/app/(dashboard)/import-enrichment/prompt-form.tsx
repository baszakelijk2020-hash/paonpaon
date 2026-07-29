"use client";

import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import {
  type ImportEnrichmentPromptFormState,
  updateImportEnrichmentPrompt,
} from "./actions";

const initialState: ImportEnrichmentPromptFormState = {
  values: {},
  fieldErrors: {},
};

export function ImportEnrichmentPromptForm({
  defaultValues,
}: {
  defaultValues: {
    slug: string;
    title: string;
    promptMarkdown: string;
    responseSchemaVersion: string;
    active: boolean;
  };
}) {
  const [state, action, pending] = useActionState(
    updateImportEnrichmentPrompt,
    {
      ...initialState,
      values: {
        slug: defaultValues.slug,
        title: defaultValues.title,
        promptMarkdown: defaultValues.promptMarkdown,
        responseSchemaVersion: defaultValues.responseSchemaVersion,
        active: defaultValues.active ? "true" : "false",
      },
    },
  );

  const values = {
    slug: state.values["slug"] ?? defaultValues.slug,
    title: state.values["title"] ?? defaultValues.title,
    promptMarkdown:
      state.values["promptMarkdown"] ?? defaultValues.promptMarkdown,
    responseSchemaVersion:
      state.values["responseSchemaVersion"] ??
      defaultValues.responseSchemaVersion,
    active: state.values["active"] ?? (defaultValues.active ? "true" : "false"),
  };

  return (
    <Card>
      <form action={action} className="grid gap-4">
        <div>
          <p className="font-medium text-[var(--color-stone-900)]">
            External prompt / LLM contract
          </p>
          <p className="mt-1 text-sm text-[var(--color-stone-500)]">
            Retailers download this contract for offline ChatGPT use. The same
            markdown is the system prompt for PAON&apos;s provider-neutral
            enrichment runner. Inferences always stay pending review.
          </p>
        </div>

        {state.saved ? (
          <p role="status" className="text-sm text-[var(--color-success-600)]">
            Prompt contract saved.
          </p>
        ) : null}
        {state.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}

        <FormField
          label="Slug"
          htmlFor="slug"
          error={state.fieldErrors["slug"]}
        >
          <Input
            id="slug"
            name="slug"
            defaultValue={values.slug}
            aria-invalid={state.fieldErrors["slug"] ? true : undefined}
          />
        </FormField>

        <FormField
          label="Title"
          htmlFor="title"
          error={state.fieldErrors["title"]}
        >
          <Input
            id="title"
            name="title"
            defaultValue={values.title}
            aria-invalid={state.fieldErrors["title"] ? true : undefined}
          />
        </FormField>

        <FormField
          label="Response schema version"
          htmlFor="responseSchemaVersion"
          error={state.fieldErrors["responseSchemaVersion"]}
        >
          <Input
            id="responseSchemaVersion"
            name="responseSchemaVersion"
            defaultValue={values.responseSchemaVersion}
            aria-invalid={
              state.fieldErrors["responseSchemaVersion"] ? true : undefined
            }
          />
        </FormField>

        <FormField
          label="Prompt markdown"
          htmlFor="promptMarkdown"
          error={state.fieldErrors["promptMarkdown"]}
          hint="Must forbid inventing mill, composition, weight, and construction."
        >
          <textarea
            id="promptMarkdown"
            name="promptMarkdown"
            rows={22}
            defaultValue={values.promptMarkdown}
            aria-invalid={
              state.fieldErrors["promptMarkdown"] ? true : undefined
            }
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-3 py-2 font-mono text-sm text-[var(--color-stone-900)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-stone-900)]"
          />
        </FormField>

        <input type="hidden" name="active" value={values.active} />

        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save prompt contract"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
