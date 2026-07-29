"use client";

import type {
  AlterationCatalogueCategory,
  AlterationOperation,
  Customer,
  Order,
  OrderLine,
} from "@paon/domain";
import { GARMENT_CATEGORIES } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState, useState } from "react";

import { createAlteration, type CreateAlterationFormState } from "./actions";

export interface IntakeOrderLine {
  order: Order;
  line: OrderLine;
}

export function AlterationForm({
  customers,
  categories,
  operations,
  orderLines,
  defaultCustomerId,
  defaultAppointmentId,
}: {
  customers: readonly Customer[];
  categories: readonly AlterationCatalogueCategory[];
  operations: readonly AlterationOperation[];
  orderLines: readonly IntakeOrderLine[];
  defaultCustomerId?: string;
  defaultAppointmentId?: string;
}) {
  const textareaClassName =
    "min-h-24 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white p-3 text-sm text-[var(--color-stone-900)] transition-colors duration-150 ease-[var(--ease-out-quiet)] placeholder:text-[var(--color-stone-400)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-stone-900)] focus-visible:ring-offset-2";
  const [state, formAction, isPending] = useActionState(createAlteration, {
    values: {},
    fieldErrors: {},
  } as CreateAlterationFormState);
  const v = state.values;
  const [customerId, setCustomerId] = useState(
    v["customerId"] ?? defaultCustomerId ?? "",
  );
  const [categoryCode, setCategoryCode] = useState(
    v["categoryCode"] ?? "jacket",
  );
  const categoryNameById = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const selectedCategoryId = categories.find(
    (category) => category.code === categoryCode,
  )?.id;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {defaultAppointmentId ? (
        <input
          type="hidden"
          name="appointmentId"
          value={defaultAppointmentId}
        />
      ) : null}
      {state.formError ? (
        <p
          role="alert"
          className="bg-[var(--color-danger-500)]/10 rounded-[var(--radius-md)] px-4 py-3 text-sm text-[var(--color-danger-500)]"
        >
          {state.formError}
        </p>
      ) : null}

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-medium sm:col-span-2">Customer & source</h2>
        <FormField
          label="Customer"
          htmlFor="customerId"
          error={state.fieldErrors["customerId"]}
        >
          <Select
            id="customerId"
            name="customerId"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            required
          >
            <option value="" disabled>
              Select a customer
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.fullName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Garment source"
          htmlFor="sourceKind"
          error={state.fieldErrors["sourceKind"]}
        >
          <Select
            id="sourceKind"
            name="sourceKind"
            defaultValue={v["sourceKind"] ?? "external"}
            required
          >
            <option value="external">External or random garment</option>
            <option value="finished_mtm">Finished MTM garment</option>
          </Select>
        </FormField>
        <FormField
          label="PAON order line"
          htmlFor="orderLineId"
          hint="Optional; use for a finished MTM line when available"
        >
          <Select
            id="orderLineId"
            name="orderLineId"
            defaultValue={v["orderLineId"] ?? ""}
          >
            <option value="">No linked PAON order line</option>
            {orderLines
              .filter(({ order }) => order.customerId === customerId)
              .map(({ order, line }) => (
                <option key={line.id} value={line.id}>
                  {order.orderNumber} · line {line.id.slice(0, 8)}
                </option>
              ))}
          </Select>
        </FormField>
        <FormField
          label="Supplier / order reference"
          htmlFor="supplierOrderReference"
          hint="Required for finished MTM when no PAON line is linked"
          error={state.fieldErrors["supplierOrderReference"]}
        >
          <Input
            id="supplierOrderReference"
            name="supplierOrderReference"
            defaultValue={v["supplierOrderReference"]}
          />
        </FormField>
      </Card>

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-medium sm:col-span-2">
          Physical garment identification
        </h2>
        <FormField
          label="Category"
          htmlFor="categoryCode"
          error={state.fieldErrors["categoryCode"]}
        >
          <Select
            id="categoryCode"
            name="categoryCode"
            value={categoryCode}
            onChange={(event) => setCategoryCode(event.target.value)}
            required
          >
            {GARMENT_CATEGORIES.filter((code) =>
              categories.some(
                (category) => category.code === code && category.enabled,
              ),
            ).map((code) => (
              <option key={code} value={code}>
                {categories.find((category) => category.code === code)?.name ??
                  code}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Garment type"
          htmlFor="garmentType"
          error={state.fieldErrors["garmentType"]}
        >
          <Input
            id="garmentType"
            name="garmentType"
            placeholder="Navy single-breasted jacket"
            defaultValue={v["garmentType"]}
            required
          />
        </FormField>
        <FormField label="Brand" htmlFor="brand" hint="Optional">
          <Input id="brand" name="brand" defaultValue={v["brand"]} />
        </FormField>
        <FormField
          label="External reference"
          htmlFor="externalReference"
          hint="Optional ticket, receipt or wardrobe reference"
        >
          <Input
            id="externalReference"
            name="externalReference"
            defaultValue={v["externalReference"]}
          />
        </FormField>
        <FormField
          label="Description"
          htmlFor="description"
          error={state.fieldErrors["description"]}
        >
          <textarea
            id="description"
            name="description"
            defaultValue={v["description"]}
            required
            className={textareaClassName}
          />
        </FormField>
        <FormField
          label="Intake condition"
          htmlFor="intakeCondition"
          error={state.fieldErrors["intakeCondition"]}
        >
          <textarea
            id="intakeCondition"
            name="intakeCondition"
            defaultValue={v["intakeCondition"]}
            required
            className={textareaClassName}
          />
        </FormField>
        <FormField
          label="Identifying photo URL"
          htmlFor="identifyingPhotoUrl"
          hint="Optional until Storage upload is connected"
        >
          <Input
            id="identifyingPhotoUrl"
            name="identifyingPhotoUrl"
            type="url"
            defaultValue={v["identifyingPhotoUrl"]}
          />
        </FormField>
        <FormField
          label="Label metadata"
          htmlFor="labelText"
          hint="Label text, serial, cloth or maker code"
        >
          <Input
            id="labelText"
            name="labelText"
            defaultValue={v["labelText"]}
          />
        </FormField>
      </Card>

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-medium sm:col-span-2">
          Fitting observation & proposed work
        </h2>
        <FormField
          label="Observation area"
          htmlFor="observationArea"
          error={state.fieldErrors["observations.0.area"]}
        >
          <Input
            id="observationArea"
            name="observationArea"
            placeholder="Right sleeve, back balance…"
            defaultValue={v["observationArea"]}
            required
          />
        </FormField>
        <FormField
          label="Common operation"
          htmlFor="operationId"
          hint="Choose an enabled operation; custom work may be left unpriced"
        >
          <Select
            id="operationId"
            name="operationId"
            defaultValue={v["operationId"] ?? ""}
          >
            <option value="">Custom / scope after inspection</option>
            {operations
              .filter(
                (operation) =>
                  operation.enabled &&
                  operation.categoryId === selectedCategoryId,
              )
              .map((operation) => (
                <option key={operation.id} value={operation.id}>
                  {categoryNameById.get(operation.categoryId)} ·{" "}
                  {operation.name}
                  {operation.effectivePrice
                    ? ` · ${operation.effectivePrice.amountMinorUnits / 100} ${operation.effectivePrice.currency}`
                    : ""}
                </option>
              ))}
          </Select>
        </FormField>
        <FormField
          label="Observation"
          htmlFor="observation"
          error={state.fieldErrors["observations.0.observation"]}
        >
          <textarea
            id="observation"
            name="observation"
            defaultValue={v["observation"]}
            required
            className={textareaClassName}
          />
        </FormField>
        <div className="flex flex-col gap-4">
          <FormField
            label="Work-now task"
            htmlFor="taskTitle"
            error={state.fieldErrors["tasks.0.title"]}
          >
            <Input
              id="taskTitle"
              name="taskTitle"
              placeholder="Shorten right sleeve 8 mm"
              defaultValue={v["taskTitle"]}
              required
            />
          </FormField>
          <FormField
            label="Task instructions"
            htmlFor="taskInstructions"
            hint="Optional"
          >
            <Input
              id="taskInstructions"
              name="taskInstructions"
              defaultValue={v["taskInstructions"]}
            />
          </FormField>
        </div>
        <FormField
          label="Future order note"
          htmlFor="futureOrderNote"
          hint="Retained for manual entry into a future GoCreate order; never assigned as current work"
        >
          <textarea
            id="futureOrderNote"
            name="futureOrderNote"
            defaultValue={v["futureOrderNote"]}
            className={textareaClassName}
          />
        </FormField>
        <FormField label="Due date" htmlFor="dueDate" hint="Optional">
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={v["dueDate"]}
          />
        </FormField>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating work order…" : "Create work order"}
        </Button>
      </div>
    </form>
  );
}
