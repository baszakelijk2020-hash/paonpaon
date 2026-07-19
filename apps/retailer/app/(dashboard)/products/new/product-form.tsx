"use client";

import { CURRENCY_CODES } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import { createProduct, type CreateProductFormState } from "./actions";

const initialCreateProductFormState: CreateProductFormState = {
  values: {},
  fieldErrors: {},
};

export function ProductForm() {
  const [state, formAction, isPending] = useActionState(
    createProduct,
    initialCreateProductFormState,
  );
  const v = state.values;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.formError ? (
        <p
          role="alert"
          className="bg-[var(--color-danger-500)]/10 rounded-[var(--radius-sm)] px-4 py-3 text-sm text-[var(--color-danger-500)]"
        >
          {state.formError}
        </p>
      ) : null}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Product
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Name"
            htmlFor="name"
            error={state.fieldErrors["name"]}
          >
            <Input
              id="name"
              name="name"
              defaultValue={v["name"]}
              invalid={!!state.fieldErrors["name"]}
              required
            />
          </FormField>
          <FormField
            label="Slug"
            htmlFor="slug"
            hint="Lowercase letters, numbers and hyphens"
            error={state.fieldErrors["slug"]}
          >
            <Input
              id="slug"
              name="slug"
              defaultValue={v["slug"]}
              invalid={!!state.fieldErrors["slug"]}
              required
            />
          </FormField>
          <FormField
            label="Status"
            htmlFor="status"
            error={state.fieldErrors["status"]}
          >
            <Select
              id="status"
              name="status"
              defaultValue={v["status"] ?? "draft"}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </Select>
          </FormField>
          <FormField
            label="Description"
            htmlFor="description"
            error={state.fieldErrors["description"]}
          >
            <Input
              id="description"
              name="description"
              defaultValue={v["description"]}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-[var(--color-stone-700)]">
            <input
              type="checkbox"
              name="isMadeToOrder"
              defaultChecked={v["isMadeToOrder"] === "on"}
            />
            Made to order
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-stone-700)]">
            <input
              type="checkbox"
              name="isAlterable"
              defaultChecked={v["isAlterable"] === "on"}
            />
            Alterable
          </label>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          First variant
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          A product is never sold at its own price — every product needs at
          least one variant. Add more from the product page afterwards.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="SKU" htmlFor="sku" error={state.fieldErrors["sku"]}>
            <Input
              id="sku"
              name="sku"
              defaultValue={v["sku"]}
              invalid={!!state.fieldErrors["sku"]}
              required
            />
          </FormField>
          <FormField label="Size" htmlFor="size">
            <Input id="size" name="size" defaultValue={v["size"]} />
          </FormField>
          <FormField label="Color" htmlFor="color">
            <Input id="color" name="color" defaultValue={v["color"]} />
          </FormField>
          <FormField
            label="Price (minor units, e.g. cents)"
            htmlFor="priceAmountMinorUnits"
            error={state.fieldErrors["priceAmountMinorUnits"]}
          >
            <Input
              id="priceAmountMinorUnits"
              name="priceAmountMinorUnits"
              type="number"
              min={0}
              defaultValue={v["priceAmountMinorUnits"]}
              invalid={!!state.fieldErrors["priceAmountMinorUnits"]}
              required
            />
          </FormField>
          <FormField
            label="Currency"
            htmlFor="priceCurrency"
            error={state.fieldErrors["priceCurrency"]}
          >
            <Select
              id="priceCurrency"
              name="priceCurrency"
              defaultValue={v["priceCurrency"] ?? "USD"}
            >
              {CURRENCY_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Inventory quantity"
            htmlFor="inventoryQuantity"
            error={state.fieldErrors["inventoryQuantity"]}
          >
            <Input
              id="inventoryQuantity"
              name="inventoryQuantity"
              type="number"
              min={0}
              defaultValue={v["inventoryQuantity"] ?? "0"}
            />
          </FormField>
          <FormField
            label="Lead time (days)"
            htmlFor="leadTimeDays"
            hint="Optional — for made-to-order variants"
          >
            <Input
              id="leadTimeDays"
              name="leadTimeDays"
              type="number"
              min={0}
              defaultValue={v["leadTimeDays"]}
            />
          </FormField>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create product"}
        </Button>
      </div>
    </form>
  );
}
