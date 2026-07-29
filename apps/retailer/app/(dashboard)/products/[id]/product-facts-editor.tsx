"use client";

import {
  type EntityMetadataAssignment,
  type MetadataConcept,
  type ProductFabricProfile,
  type ProductVariant,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState, useState } from "react";

import {
  proposeProductCatalogueAssignment,
  reviewProductCatalogueAssignment,
  saveProductFabricProfile,
  saveVariantFabricProfile,
  type ProductFactsFormState,
} from "./product-facts-actions";

const initialState: ProductFactsFormState = {
  values: {},
  fieldErrors: {},
};

const PROPOSAL_SOURCES = ["supplier", "retailer", "ai"] as const;
const MAX_COMPOSITION_ROWS = 6;

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

function FormStatus({ state }: { state: ProductFactsFormState }) {
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

function compositionDefaults(profile: ProductFabricProfile | null): {
  fibreConceptIds: string[];
  percentages: string[];
} {
  const rows = profile?.composition ?? [];
  const fibreConceptIds = rows.map((row) => String(row.fibreConceptId));
  const percentages = rows.map((row) => String(row.percentage));
  while (fibreConceptIds.length < 2) {
    fibreConceptIds.push("");
    percentages.push("");
  }
  return { fibreConceptIds, percentages };
}

function FabricProfileFields({
  idPrefix,
  profile,
  fibreConcepts,
  state,
}: {
  idPrefix: string;
  profile: ProductFabricProfile | null;
  fibreConcepts: readonly MetadataConcept[];
  state: ProductFactsFormState;
}) {
  const defaults = compositionDefaults(profile);
  const [rowCount, setRowCount] = useState(
    Math.min(
      MAX_COMPOSITION_ROWS,
      Math.max(2, defaults.fibreConceptIds.length),
    ),
  );

  return (
    <>
      <FormField
        label="Fabric weight (g/m²)"
        htmlFor={`${idPrefix}-weight`}
        error={state.fieldErrors["fabricWeightGramsPerSquareMetre"]}
      >
        <Input
          id={`${idPrefix}-weight`}
          name="fabricWeightGramsPerSquareMetre"
          type="number"
          min="0.01"
          max="2000"
          step="0.01"
          defaultValue={
            state.values["fabricWeightGramsPerSquareMetre"] ??
            (profile?.fabricWeightGramsPerSquareMetre === undefined
              ? ""
              : String(profile.fabricWeightGramsPerSquareMetre))
          }
          invalid={!!state.fieldErrors["fabricWeightGramsPerSquareMetre"]}
          aria-label="Fabric weight in grams per square metre"
        />
      </FormField>
      <FormField
        label="Supplier reference"
        htmlFor={`${idPrefix}-supplier`}
        hint="Provenance only — not a concept label"
        error={state.fieldErrors["supplierReference"]}
      >
        <Input
          id={`${idPrefix}-supplier`}
          name="supplierReference"
          defaultValue={
            state.values["supplierReference"] ??
            profile?.supplierReference ??
            ""
          }
          invalid={!!state.fieldErrors["supplierReference"]}
          aria-label="Supplier reference"
        />
      </FormField>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-medium text-[var(--color-stone-900)]">
          Composition
        </legend>
        <p className="mb-3 text-sm text-[var(--color-stone-500)]">
          Link fibre concepts and percentages that total exactly 100. Accepted
          fibre names are never copied into a free-text field.
        </p>
        {state.fieldErrors["composition"] ? (
          <p
            role="alert"
            className="mb-3 text-sm text-[var(--color-danger-500)]"
          >
            {state.fieldErrors["composition"]}
          </p>
        ) : null}
        <div className="grid gap-3">
          {Array.from({ length: rowCount }, (_, index) => (
            <div
              key={`${idPrefix}-row-${index}`}
              className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]"
            >
              <Select
                name="fibreConceptId"
                defaultValue={defaults.fibreConceptIds[index] ?? ""}
                aria-label={`Fibre concept ${index + 1}`}
              >
                <option value="">No fibre</option>
                {fibreConcepts.map((concept) => (
                  <option key={concept.id} value={concept.id}>
                    {concept.canonicalName}
                    {concept.retailerId === null ? "" : " (local)"}
                  </option>
                ))}
              </Select>
              <Input
                name="percentage"
                type="number"
                min="0.0001"
                max="100"
                step="0.0001"
                defaultValue={defaults.percentages[index] ?? ""}
                aria-label={`Fibre percentage ${index + 1}`}
                placeholder="%"
              />
            </div>
          ))}
        </div>
        {rowCount < MAX_COMPOSITION_ROWS ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setRowCount((count) => count + 1)}
          >
            Add fibre row
          </Button>
        ) : null}
        {fibreConcepts.length === 0 ? (
          <p
            role="status"
            className="mt-3 text-sm text-[var(--color-stone-500)]"
          >
            No fibre concepts are visible yet. Create a local fibre on Metadata
            review or wait for PAON canonical vocabulary.
          </p>
        ) : null}
      </fieldset>
    </>
  );
}

function PendingAssignmentReview({
  productId,
  assignment,
}: {
  productId: string;
  assignment: EntityMetadataAssignment;
}) {
  const [state, action, pending] = useActionState(
    reviewProductCatalogueAssignment,
    initialState,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="productId" value={productId} />
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
  );
}

function AssignmentList({
  productId,
  assignments,
  conceptsById,
}: {
  productId: string;
  assignments: readonly EntityMetadataAssignment[];
  conceptsById: ReadonlyMap<string, MetadataConcept>;
}) {
  if (assignments.length === 0) {
    return (
      <p role="status" className="text-sm text-[var(--color-stone-500)]">
        No catalogue assignments yet.
      </p>
    );
  }

  return (
    <ul className="grid gap-3">
      {assignments.map((assignment) => {
        const concept = conceptsById.get(String(assignment.conceptId));
        return (
          <li
            key={assignment.id}
            className="flex flex-col gap-3 border-t border-[var(--color-stone-200)] pt-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-[var(--color-stone-900)]">
                  {concept
                    ? `${kindLabel(concept.kind)} · ${concept.canonicalName}`
                    : assignment.conceptId}
                </p>
                <Badge tone={reviewTone(assignment.reviewStatus)}>
                  {assignment.reviewStatus}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                Source {assignment.source}
                {assignment.supplierValue
                  ? ` · supplier “${assignment.supplierValue}”`
                  : ""}
                {assignment.confidence === undefined
                  ? ""
                  : ` · confidence ${assignment.confidence}`}
              </p>
            </div>
            {assignment.reviewStatus === "pending" ? (
              <PendingAssignmentReview
                productId={productId}
                assignment={assignment}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function ProposeAssignmentForm({
  productId,
  targetType,
  targetId,
  concepts,
}: {
  productId: string;
  targetType: "product" | "product_variant";
  targetId: string;
  concepts: readonly MetadataConcept[];
}) {
  const [state, action, pending] = useActionState(
    proposeProductCatalogueAssignment,
    initialState,
  );

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <FormField
        label="Concept"
        htmlFor={`${targetId}-concept`}
        error={state.fieldErrors["conceptId"]}
      >
        <Select
          id={`${targetId}-concept`}
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
        htmlFor={`${targetId}-source`}
        error={state.fieldErrors["source"]}
      >
        <Select
          id={`${targetId}-source`}
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
        htmlFor={`${targetId}-supplier-value`}
        hint="Required for supplier source"
        error={state.fieldErrors["supplierValue"]}
      >
        <Input
          id={`${targetId}-supplier-value`}
          name="supplierValue"
          defaultValue={state.values["supplierValue"]}
          invalid={!!state.fieldErrors["supplierValue"]}
        />
      </FormField>
      <FormField
        label="Confidence"
        htmlFor={`${targetId}-confidence`}
        hint="0–1, required for AI"
        error={state.fieldErrors["confidence"]}
      >
        <Input
          id={`${targetId}-confidence`}
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
        htmlFor={`${targetId}-evidence`}
        hint="Required for AI"
        error={state.fieldErrors["evidence.summary"]}
      >
        <Input
          id={`${targetId}-evidence`}
          name="evidenceSummary"
          defaultValue={state.values["evidenceSummary"]}
          invalid={!!state.fieldErrors["evidence.summary"]}
        />
      </FormField>
      <FormField
        label="Evidence reference"
        htmlFor={`${targetId}-evidence-ref`}
        hint="Optional"
        error={state.fieldErrors["evidence.sourceReference"]}
      >
        <Input
          id={`${targetId}-evidence-ref`}
          name="evidenceSourceReference"
          defaultValue={state.values["evidenceSourceReference"]}
          invalid={!!state.fieldErrors["evidence.sourceReference"]}
        />
      </FormField>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending || concepts.length === 0}
        >
          {pending ? "Proposing…" : "Propose assignment"}
        </Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function ProductFabricEditor({
  productId,
  profile,
  fibreConcepts,
}: {
  productId: string;
  profile: ProductFabricProfile | null;
  fibreConcepts: readonly MetadataConcept[];
}) {
  const [state, action, pending] = useActionState(
    saveProductFabricProfile,
    initialState,
  );

  return (
    <Card>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Exact fabric facts
          </h2>
          <p className="mt-1 text-sm text-[var(--color-stone-500)]">
            Product-level weight, supplier reference, and concept-linked
            composition. Variants inherit these unless they genuinely differ.
          </p>
        </div>
        <input type="hidden" name="productId" value={productId} />
        <FabricProfileFields
          idPrefix="product-fabric"
          profile={profile}
          fibreConcepts={fibreConcepts}
          state={state}
        />
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save fabric facts"}
          </Button>
          <FormStatus state={state} />
        </div>
      </form>
    </Card>
  );
}

export function VariantFabricEditor({
  productId,
  variant,
  profile,
  fibreConcepts,
}: {
  productId: string;
  variant: ProductVariant;
  profile: ProductFabricProfile | null;
  fibreConcepts: readonly MetadataConcept[];
}) {
  const [open, setOpen] = useState(profile !== null);
  const [state, action, pending] = useActionState(
    saveVariantFabricProfile,
    initialState,
  );
  const label = [variant.sku, variant.size, variant.color]
    .filter(Boolean)
    .join(" · ");

  if (!open) {
    return (
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-[var(--color-stone-900)]">{label}</p>
            <p className="text-sm text-[var(--color-stone-500)]">
              Inherits product fabric facts. Add a variant profile only when
              this SKU truly differs.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setOpen(true)}
          >
            Add variant fabric facts
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h3 className="font-medium text-[var(--color-stone-900)]">{label}</h3>
          <p className="mt-1 text-sm text-[var(--color-stone-500)]">
            Variant-specific fabric facts override the product profile for this
            SKU only.
          </p>
        </div>
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="productVariantId" value={variant.id} />
        <FabricProfileFields
          idPrefix={`variant-fabric-${variant.id}`}
          profile={profile}
          fibreConcepts={fibreConcepts}
          state={state}
        />
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save variant fabric facts"}
          </Button>
          <FormStatus state={state} />
        </div>
      </form>
    </Card>
  );
}

export function ProductCatalogueAssignments({
  productId,
  concepts,
  productAssignments,
  variants,
  assignmentsByVariantId,
}: {
  productId: string;
  concepts: readonly MetadataConcept[];
  productAssignments: readonly EntityMetadataAssignment[];
  variants: readonly ProductVariant[];
  assignmentsByVariantId: ReadonlyMap<
    string,
    readonly EntityMetadataAssignment[]
  >;
}) {
  const conceptsById = new Map(
    concepts.map((concept) => [concept.id, concept] as const),
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Catalogue assignments
          </h2>
          <p className="mt-1 text-sm text-[var(--color-stone-500)]">
            Assign reviewed concepts to this product. Labels stay on the concept
            — they are not duplicated into product strings.
          </p>
        </div>
        <AssignmentList
          productId={productId}
          assignments={productAssignments}
          conceptsById={conceptsById}
        />
        <div className="mt-6 border-t border-[var(--color-stone-200)] pt-4">
          <ProposeAssignmentForm
            productId={productId}
            targetType="product"
            targetId={productId}
            concepts={concepts}
          />
        </div>
      </Card>

      {variants.map((variant) => {
        const label = [variant.sku, variant.size, variant.color]
          .filter(Boolean)
          .join(" · ");
        return (
          <Card key={variant.id}>
            <div className="mb-4">
              <h3 className="font-medium text-[var(--color-stone-900)]">
                Variant assignments · {label}
              </h3>
              <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                Use only for attributes that differ by size, colour, or SKU.
              </p>
            </div>
            <AssignmentList
              productId={productId}
              assignments={assignmentsByVariantId.get(variant.id) ?? []}
              conceptsById={conceptsById}
            />
            <div className="mt-6 border-t border-[var(--color-stone-200)] pt-4">
              <ProposeAssignmentForm
                productId={productId}
                targetType="product_variant"
                targetId={variant.id}
                concepts={concepts}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
