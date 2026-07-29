"use client";

import {
  METADATA_CONCEPT_KINDS,
  type EntityMetadataAssignment,
  type MetadataConcept,
  type Product,
  type RetailerConceptOverride,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  createRetailerMetadataConcept,
  proposeMetadataAssignment,
  reviewMetadataAssignment,
  type MetadataFormState,
  upsertRetailerConceptOverride,
} from "./actions";

const initialState: MetadataFormState = {
  values: {},
  fieldErrors: {},
};

const PROPOSAL_SOURCES = ["supplier", "retailer", "ai"] as const;

function kindLabel(kind: string): string {
  return kind.replaceAll("_", " ");
}

function reviewTone(
  status: EntityMetadataAssignment["reviewStatus"],
): "warning" | "success" | "danger" {
  switch (status) {
    case "pending":
      return "warning";
    case "accepted":
      return "success";
    case "rejected":
      return "danger";
  }
}

function FormStatus({ state }: { state: MetadataFormState }) {
  if (state.saved) {
    return (
      <span role="status" className="text-sm text-[var(--color-stone-500)]">
        Saved
      </span>
    );
  }
  if (state.formError || Object.values(state.fieldErrors)[0]) {
    return (
      <span role="alert" className="text-sm text-[var(--color-danger-500)]">
        {state.formError ?? Object.values(state.fieldErrors)[0]}
      </span>
    );
  }
  return null;
}

export function ProposeAssignmentForm({
  concepts,
  products,
}: {
  concepts: readonly MetadataConcept[];
  products: readonly Product[];
}) {
  const [state, action, pending] = useActionState(
    proposeMetadataAssignment,
    initialState,
  );

  return (
    <Card>
      <form action={action} className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <p className="font-medium text-[var(--color-stone-900)]">
            Propose assignment
          </p>
          <p className="mt-1 text-sm text-[var(--color-stone-500)]">
            New assignments stay pending until a manager accepts or rejects
            them. Unknown supplier values never become accepted silently.
          </p>
        </div>
        <FormField
          label="Product"
          htmlFor="targetId"
          error={
            state.fieldErrors["target.targetId"] ??
            state.fieldErrors["targetId"]
          }
        >
          <Select
            id="targetId"
            name="targetId"
            defaultValue={state.values["targetId"] ?? ""}
            invalid={
              !!(
                state.fieldErrors["target.targetId"] ??
                state.fieldErrors["targetId"]
              )
            }
            required
          >
            <option value="" disabled>
              Select a product
            </option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>
        </FormField>
        <input type="hidden" name="targetType" value="product" />
        <FormField
          label="Concept"
          htmlFor="conceptId"
          error={state.fieldErrors["conceptId"]}
        >
          <Select
            id="conceptId"
            name="conceptId"
            defaultValue={state.values["conceptId"] ?? ""}
            invalid={!!state.fieldErrors["conceptId"]}
            required
          >
            <option value="" disabled>
              Select a concept
            </option>
            {concepts.map((concept) => (
              <option key={concept.id} value={concept.id}>
                {kindLabel(concept.kind)} · {concept.canonicalName}
                {concept.retailerId === null ? "" : " (local)"}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Source"
          htmlFor="source"
          error={state.fieldErrors["source"]}
        >
          <Select
            id="source"
            name="source"
            defaultValue={state.values["source"] ?? "retailer"}
            invalid={!!state.fieldErrors["source"]}
          >
            {PROPOSAL_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Supplier value"
          htmlFor="supplierValue"
          hint="Required for supplier source"
          error={state.fieldErrors["supplierValue"]}
        >
          <Input
            id="supplierValue"
            name="supplierValue"
            defaultValue={state.values["supplierValue"]}
            invalid={!!state.fieldErrors["supplierValue"]}
          />
        </FormField>
        <FormField
          label="Confidence"
          htmlFor="confidence"
          hint="0–1, required for AI"
          error={state.fieldErrors["confidence"]}
        >
          <Input
            id="confidence"
            name="confidence"
            type="number"
            min="0"
            max="1"
            step="0.0001"
            defaultValue={state.values["confidence"]}
            invalid={!!state.fieldErrors["confidence"]}
          />
        </FormField>
        <FormField
          label="Evidence summary"
          htmlFor="evidenceSummary"
          hint="Required for AI"
          error={state.fieldErrors["evidence.summary"]}
        >
          <Input
            id="evidenceSummary"
            name="evidenceSummary"
            defaultValue={state.values["evidenceSummary"]}
            invalid={!!state.fieldErrors["evidence.summary"]}
          />
        </FormField>
        <FormField
          label="Evidence reference"
          htmlFor="evidenceSourceReference"
          hint="Optional"
          error={state.fieldErrors["evidence.sourceReference"]}
        >
          <Input
            id="evidenceSourceReference"
            name="evidenceSourceReference"
            defaultValue={state.values["evidenceSourceReference"]}
            invalid={!!state.fieldErrors["evidence.sourceReference"]}
          />
        </FormField>
        <div className="flex items-center gap-3 lg:col-span-2">
          <Button type="submit" disabled={pending || products.length === 0}>
            {pending ? "Proposing…" : "Propose assignment"}
          </Button>
          <FormStatus state={state} />
        </div>
        {products.length === 0 ? (
          <p
            role="status"
            className="text-sm text-[var(--color-stone-500)] lg:col-span-2"
          >
            Add a product before proposing catalogue metadata.
          </p>
        ) : null}
        {concepts.length === 0 ? (
          <p
            role="status"
            className="text-sm text-[var(--color-stone-500)] lg:col-span-2"
          >
            No visible concepts yet. Create a local concept below or wait for
            PAON canonical vocabulary.
          </p>
        ) : null}
      </form>
    </Card>
  );
}

export function CreateLocalConceptForm() {
  const [state, action, pending] = useActionState(
    createRetailerMetadataConcept,
    initialState,
  );

  return (
    <Card>
      <form action={action} className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <p className="font-medium text-[var(--color-stone-900)]">
            Add local concept
          </p>
          <p className="mt-1 text-sm text-[var(--color-stone-500)]">
            Unknown values stay retailer-owned. They do not expand PAON&apos;s
            canonical taxonomy.
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
          label="Name"
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
            placeholder="local-merino-blend"
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
        <div className="flex items-center gap-3 lg:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add local concept"}
          </Button>
          <FormStatus state={state} />
        </div>
      </form>
    </Card>
  );
}

export function PendingAssignmentCard({
  assignment,
  concept,
}: {
  assignment: EntityMetadataAssignment;
  concept: MetadataConcept | undefined;
}) {
  const [state, action, pending] = useActionState(
    reviewMetadataAssignment,
    initialState,
  );

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={reviewTone(assignment.reviewStatus)}>
            {assignment.reviewStatus}
          </Badge>
          <Badge>{assignment.source}</Badge>
          {concept ? (
            <span className="text-sm text-[var(--color-stone-700)]">
              {kindLabel(concept.kind)} · {concept.canonicalName}
            </span>
          ) : (
            <span className="text-sm text-[var(--color-stone-500)]">
              Concept unavailable
            </span>
          )}
        </div>
        <dl className="grid gap-2 text-sm text-[var(--color-stone-600)] sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-stone-500)]">Target</dt>
            <dd>
              {assignment.target.targetType} · {assignment.target.targetId}
            </dd>
          </div>
          {assignment.supplierValue ? (
            <div>
              <dt className="text-[var(--color-stone-500)]">Supplier value</dt>
              <dd>{assignment.supplierValue}</dd>
            </div>
          ) : null}
          {assignment.confidence !== undefined ? (
            <div>
              <dt className="text-[var(--color-stone-500)]">Confidence</dt>
              <dd>{assignment.confidence}</dd>
            </div>
          ) : null}
          {assignment.evidence ? (
            <div className="sm:col-span-2">
              <dt className="text-[var(--color-stone-500)]">Evidence</dt>
              <dd>
                {assignment.evidence.summary}
                {assignment.evidence.sourceReference
                  ? ` · ${assignment.evidence.sourceReference}`
                  : ""}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-[var(--color-stone-500)]">Proposed</dt>
            <dd>{new Date(assignment.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <Button
            type="submit"
            name="decision"
            value="accepted"
            size="sm"
            disabled={pending}
          >
            {pending ? "Reviewing…" : "Accept"}
          </Button>
          <Button
            type="submit"
            name="decision"
            value="rejected"
            size="sm"
            variant="secondary"
            disabled={pending}
          >
            Reject
          </Button>
          <FormStatus state={state} />
        </form>
      </div>
    </Card>
  );
}

export function ConceptOverrideForm({
  concepts,
  existing,
}: {
  concepts: readonly MetadataConcept[];
  existing: RetailerConceptOverride | undefined;
}) {
  const [state, action, pending] = useActionState(
    upsertRetailerConceptOverride,
    initialState,
  );

  return (
    <Card>
      <form action={action} className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <p className="font-medium text-[var(--color-stone-900)]">
            Local presentation override
          </p>
          <p className="mt-1 text-sm text-[var(--color-stone-500)]">
            Change display name, summary, visibility, or priority without
            mutating the concept itself.
          </p>
        </div>
        <FormField
          label="Concept"
          htmlFor="overrideConceptId"
          error={state.fieldErrors["conceptId"]}
        >
          <Select
            id="overrideConceptId"
            name="conceptId"
            defaultValue={
              state.values["conceptId"] ?? existing?.conceptId ?? ""
            }
            invalid={!!state.fieldErrors["conceptId"]}
            required
          >
            <option value="" disabled>
              Select a concept
            </option>
            {concepts.map((concept) => (
              <option key={concept.id} value={concept.id}>
                {kindLabel(concept.kind)} · {concept.canonicalName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Display name"
          htmlFor="displayName"
          hint="Optional"
          error={state.fieldErrors["displayName"]}
        >
          <Input
            id="displayName"
            name="displayName"
            defaultValue={
              state.values["displayName"] ?? existing?.displayName ?? ""
            }
            invalid={!!state.fieldErrors["displayName"]}
          />
        </FormField>
        <FormField
          label="Summary override"
          htmlFor="summaryOverride"
          hint="Optional"
          error={state.fieldErrors["summaryOverride"]}
        >
          <Input
            id="summaryOverride"
            name="summaryOverride"
            defaultValue={
              state.values["summaryOverride"] ?? existing?.summaryOverride ?? ""
            }
            invalid={!!state.fieldErrors["summaryOverride"]}
          />
        </FormField>
        <FormField
          label="Image URL override"
          htmlFor="imageUrlOverride"
          hint="Optional"
          error={state.fieldErrors["imageUrlOverride"]}
        >
          <Input
            id="imageUrlOverride"
            name="imageUrlOverride"
            type="url"
            defaultValue={
              state.values["imageUrlOverride"] ??
              existing?.imageUrlOverride ??
              ""
            }
            invalid={!!state.fieldErrors["imageUrlOverride"]}
          />
        </FormField>
        <FormField
          label="Priority override"
          htmlFor="priorityOverride"
          hint="Optional integer"
          error={state.fieldErrors["priorityOverride"]}
        >
          <Input
            id="priorityOverride"
            name="priorityOverride"
            type="number"
            defaultValue={
              state.values["priorityOverride"] ??
              (existing?.priorityOverride === undefined
                ? ""
                : String(existing.priorityOverride))
            }
            invalid={!!state.fieldErrors["priorityOverride"]}
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-[var(--color-stone-700)] lg:col-span-2">
          <input
            type="checkbox"
            name="isHidden"
            defaultChecked={existing?.isHidden ?? false}
          />
          Hide this concept locally
        </label>
        <div className="flex items-center gap-3 lg:col-span-2">
          <Button type="submit" disabled={pending || concepts.length === 0}>
            {pending ? "Saving…" : "Save override"}
          </Button>
          <FormStatus state={state} />
        </div>
      </form>
    </Card>
  );
}
