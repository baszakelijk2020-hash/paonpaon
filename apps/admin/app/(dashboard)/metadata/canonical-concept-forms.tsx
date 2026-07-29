"use client";

import { METADATA_CONCEPT_KINDS, type MetadataConcept } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  createCanonicalConcept,
  type CanonicalMetadataFormState,
  updateCanonicalConcept,
} from "./actions";

const initialState: CanonicalMetadataFormState = {
  values: {},
  fieldErrors: {},
};

function kindLabel(kind: string): string {
  return kind.replaceAll("_", " ");
}

function AttributesField({
  id,
  defaultValue,
  error,
}: {
  id: string;
  defaultValue: string | undefined;
  error: string | undefined;
}) {
  return (
    <FormField
      label="Attributes"
      htmlFor={id}
      hint="Optional JSON object"
      error={error}
    >
      <textarea
        id={id}
        name="attributes"
        defaultValue={defaultValue}
        rows={3}
        aria-invalid={error ? true : undefined}
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-3 py-2 font-mono text-sm text-[var(--color-stone-900)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-stone-900)]"
      />
    </FormField>
  );
}

export function CreateCanonicalConceptForm() {
  const [state, action, pending] = useActionState(
    createCanonicalConcept,
    initialState,
  );

  return (
    <Card>
      <form action={action} className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <p className="font-medium text-[var(--color-stone-900)]">
            Add canonical concept
          </p>
          <p className="mt-1 text-sm text-[var(--color-stone-500)]">
            PAON-owned concepts are reusable across every retailer. Unknown
            tenant values stay local until deliberately added here.
          </p>
        </div>
        <FormField
          label="Kind"
          htmlFor="kind"
          error={state.fieldErrors["kind"]}
        >
          <Select
            id="kind"
            name="kind"
            defaultValue={state.values["kind"] ?? "fibre"}
            invalid={!!state.fieldErrors["kind"]}
          >
            {METADATA_CONCEPT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kindLabel(kind)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Canonical name"
          htmlFor="canonicalName"
          error={state.fieldErrors["canonicalName"]}
        >
          <Input
            id="canonicalName"
            name="canonicalName"
            defaultValue={state.values["canonicalName"]}
            invalid={!!state.fieldErrors["canonicalName"]}
            required
          />
        </FormField>
        <FormField
          label="Slug"
          htmlFor="slug"
          error={state.fieldErrors["slug"]}
        >
          <Input
            id="slug"
            name="slug"
            defaultValue={state.values["slug"]}
            invalid={!!state.fieldErrors["slug"]}
            placeholder="super-120s-wool"
            required
          />
        </FormField>
        <FormField
          label="Image URL"
          htmlFor="imageUrl"
          hint="Optional"
          error={state.fieldErrors["imageUrl"]}
        >
          <Input
            id="imageUrl"
            name="imageUrl"
            type="url"
            defaultValue={state.values["imageUrl"]}
            invalid={!!state.fieldErrors["imageUrl"]}
          />
        </FormField>
        <div className="lg:col-span-2">
          <AttributesField
            id="attributes"
            defaultValue={state.values["attributes"]}
            error={state.fieldErrors["attributes"]}
          />
        </div>
        <div className="flex items-center gap-3 lg:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add canonical concept"}
          </Button>
          {state.saved ? (
            <span
              role="status"
              className="text-sm text-[var(--color-stone-500)]"
            >
              Added
            </span>
          ) : null}
          {state.formError ? (
            <span
              role="alert"
              className="text-sm text-[var(--color-danger-500)]"
            >
              {state.formError}
            </span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

export function CanonicalConceptEditor({
  concept,
}: {
  concept: MetadataConcept;
}) {
  const [state, action, pending] = useActionState(
    updateCanonicalConcept,
    initialState,
  );

  return (
    <Card>
      <form action={action} className="grid gap-4 lg:grid-cols-2">
        <input type="hidden" name="conceptId" value={concept.id} />
        <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
          <Badge>{kindLabel(concept.kind)}</Badge>
          <span className="text-sm text-[var(--color-stone-500)]">
            {concept.slug}
          </span>
          <Badge tone={concept.active ? "success" : "warning"}>
            {concept.active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <FormField
          label="Canonical name"
          htmlFor={`canonicalName-${concept.id}`}
          error={state.fieldErrors["canonicalName"]}
        >
          <Input
            id={`canonicalName-${concept.id}`}
            name="canonicalName"
            defaultValue={
              state.values["canonicalName"] ?? concept.canonicalName
            }
            invalid={!!state.fieldErrors["canonicalName"]}
            required
          />
        </FormField>
        <FormField
          label="Image URL"
          htmlFor={`imageUrl-${concept.id}`}
          hint="Optional"
          error={state.fieldErrors["imageUrl"]}
        >
          <Input
            id={`imageUrl-${concept.id}`}
            name="imageUrl"
            type="url"
            defaultValue={state.values["imageUrl"] ?? concept.imageUrl}
            invalid={!!state.fieldErrors["imageUrl"]}
          />
        </FormField>
        <div className="lg:col-span-2">
          <AttributesField
            id={`attributes-${concept.id}`}
            defaultValue={
              state.values["attributes"] ??
              JSON.stringify(concept.attributes, null, 2)
            }
            error={state.fieldErrors["attributes"]}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-stone-700)] lg:col-span-2">
          <input
            type="checkbox"
            name="active"
            defaultChecked={concept.active}
          />
          Eligible for new assignments
        </label>
        <div className="flex items-center gap-3 lg:col-span-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save concept"}
          </Button>
          {state.saved ? (
            <span
              role="status"
              className="text-sm text-[var(--color-stone-500)]"
            >
              Saved
            </span>
          ) : null}
          {state.formError || Object.values(state.fieldErrors)[0] ? (
            <span
              role="alert"
              className="text-sm text-[var(--color-danger-500)]"
            >
              {state.formError ?? Object.values(state.fieldErrors)[0]}
            </span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
