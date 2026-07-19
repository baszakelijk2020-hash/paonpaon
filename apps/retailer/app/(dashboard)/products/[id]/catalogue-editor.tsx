"use client";

import {
  CURRENCY_CODES,
  type Collection,
  type Product,
  type ProductVariant,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  updateProduct,
  updateVariant,
  type CatalogueFormState,
} from "./actions";

const initial: CatalogueFormState = { fieldErrors: {} };

export function ProductEditor({
  product,
  collections,
}: {
  product: Product;
  collections: Collection[];
}) {
  const [state, action, pending] = useActionState(updateProduct, initial);
  return (
    <Card>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="productId" value={product.id} />
        <Input
          name="name"
          defaultValue={product.name}
          aria-label="Product name"
          required
        />
        <Input
          name="slug"
          defaultValue={product.slug}
          aria-label="Product slug"
          required
        />
        <Input
          name="description"
          defaultValue={product.description}
          aria-label="Description"
        />
        <Input
          name="primaryImageUrl"
          defaultValue={product.primaryImageUrl}
          placeholder="Primary image URL"
          aria-label="Primary image URL"
        />
        <Select name="status" defaultValue={product.status} aria-label="Status">
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </Select>
        <div className="flex gap-4">
          <label>
            <input
              type="checkbox"
              name="isMadeToOrder"
              defaultChecked={product.isMadeToOrder}
            />{" "}
            Made to order
          </label>
          <label>
            <input
              type="checkbox"
              name="isAlterable"
              defaultChecked={product.isAlterable}
            />{" "}
            Alterable
          </label>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">Collections</legend>
          <div className="flex flex-wrap gap-4">
            {collections.map((collection) => (
              <label key={collection.id} className="text-sm">
                <input
                  type="checkbox"
                  name="collectionIds"
                  value={collection.id}
                  defaultChecked={product.collectionIds.includes(collection.id)}
                />{" "}
                {collection.name}
              </label>
            ))}
          </div>
        </fieldset>
        {state.formError || Object.values(state.fieldErrors)[0] ? (
          <p
            role="alert"
            className="text-sm text-[var(--color-danger-500)] sm:col-span-2"
          >
            {state.formError ?? Object.values(state.fieldErrors)[0]}
          </p>
        ) : null}
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save product"}
          </Button>
          {state.saved ? (
            <span className="text-sm text-[var(--color-stone-500)]">Saved</span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

export function VariantEditor({ variant }: { variant: ProductVariant }) {
  const [state, action, pending] = useActionState(updateVariant, initial);
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-4">
        <input type="hidden" name="id" value={variant.id} />
        <input type="hidden" name="productId" value={variant.productId} />
        <Input
          name="sku"
          defaultValue={variant.sku}
          aria-label="SKU"
          required
        />
        <Input
          name="size"
          defaultValue={variant.size}
          placeholder="Size"
          aria-label="Size"
        />
        <Input
          name="color"
          defaultValue={variant.color}
          placeholder="Color"
          aria-label="Color"
        />
        <Select
          name="priceCurrency"
          defaultValue={variant.price.currency}
          aria-label="Currency"
        >
          {CURRENCY_CODES.map((code) => (
            <option key={code}>{code}</option>
          ))}
        </Select>
        <Input
          name="priceAmountMinorUnits"
          type="number"
          min={0}
          defaultValue={variant.price.amountMinorUnits}
          aria-label="Price in minor units"
          required
        />
        <Input
          name="compareAtPriceAmountMinorUnits"
          type="number"
          min={0}
          defaultValue={variant.compareAtPrice?.amountMinorUnits}
          placeholder="Compare price"
          aria-label="Compare price"
        />
        <Input
          name="inventoryQuantity"
          type="number"
          min={0}
          defaultValue={variant.inventoryQuantity}
          aria-label="Inventory"
          required
        />
        <Input
          name="leadTimeDays"
          type="number"
          min={0}
          defaultValue={variant.leadTimeDays}
          placeholder="Lead days"
          aria-label="Lead time days"
        />
        {state.formError || Object.values(state.fieldErrors)[0] ? (
          <p
            role="alert"
            className="text-sm text-[var(--color-danger-500)] sm:col-span-4"
          >
            {state.formError ?? Object.values(state.fieldErrors)[0]}
          </p>
        ) : null}
        <div className="flex items-center gap-3 sm:col-span-4">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save variant"}
          </Button>
          {state.saved ? (
            <span className="text-sm text-[var(--color-stone-500)]">Saved</span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
