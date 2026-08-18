"use client";

import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useState } from "react";

const PERIOD_OPTIONS = [
  { value: "annual", label: "Annual" },
  { value: "biennial", label: "Biennial" },
  { value: "on_joining", label: "On joining (one-off)" },
] as const;

interface RuleRow {
  roleKey: string;
  garmentKey: string;
  quantity: number;
  period: (typeof PERIOD_OPTIONS)[number]["value"];
}

const EMPTY_ROW: RuleRow = {
  roleKey: "",
  garmentKey: "",
  quantity: 1,
  period: "annual",
};

export function RolesStepForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const [rows, setRows] = useState<RuleRow[]>([{ ...EMPTY_ROW }]);

  function updateRow(index: number, patch: Partial<RuleRow>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((current) => [...current, { ...EMPTY_ROW }]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  const validRows = rows.filter(
    (row) => row.roleKey.trim() && row.garmentKey.trim() && row.quantity > 0,
  );

  return (
    <form
      action={action}
      className="flex flex-col gap-6"
      onSubmit={() => {
        // rules are serialized into the hidden field below on every render
      }}
    >
      <input type="hidden" name="rules" value={JSON.stringify(validRows)} />

      <p className="text-sm text-[var(--color-stone-500)]">
        Define each role and the garments it entitles a wearer to. To model a
        permanent-vs-temporary difference, add two role rows with distinct names
        — e.g. &quot;Sales Associate — Permanent&quot; and &quot;Sales Associate
        — Temporary&quot; — each with its own quantities. The same role name can
        appear on multiple rows to grant several garment kinds.
      </p>

      <div className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <Card key={index} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                Rule {index + 1}
              </h3>
              {rows.length > 1 ? (
                <button
                  type="button"
                  className="text-xs text-[var(--color-stone-500)] underline"
                  onClick={() => removeRow(index)}
                >
                  Remove
                </button>
              ) : null}
            </div>

            <FormField label="Role" htmlFor={`roleKey-${index}`}>
              <Input
                id={`roleKey-${index}`}
                placeholder="e.g. Sales Associate — Permanent"
                value={row.roleKey}
                onChange={(e) => updateRow(index, { roleKey: e.target.value })}
              />
            </FormField>

            <FormField label="Garment" htmlFor={`garmentKey-${index}`}>
              <Input
                id={`garmentKey-${index}`}
                placeholder="e.g. jacket"
                value={row.garmentKey}
                onChange={(e) =>
                  updateRow(index, { garmentKey: e.target.value })
                }
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Quantity" htmlFor={`quantity-${index}`}>
                <Input
                  id={`quantity-${index}`}
                  type="number"
                  min={1}
                  value={row.quantity}
                  onChange={(e) =>
                    updateRow(index, {
                      quantity: Number(e.target.value) || 1,
                    })
                  }
                />
              </FormField>

              <FormField label="Period" htmlFor={`period-${index}`}>
                <Select
                  id={`period-${index}`}
                  value={row.period}
                  onChange={(e) =>
                    updateRow(index, {
                      period: e.target.value as RuleRow["period"],
                    })
                  }
                >
                  {PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </Card>
        ))}
      </div>

      <Button type="button" variant="secondary" onClick={addRow}>
        Add another rule
      </Button>

      <Button
        type="submit"
        className="self-start"
        disabled={validRows.length === 0}
      >
        Save roles and entitlements → continue to employees
      </Button>
    </form>
  );
}
