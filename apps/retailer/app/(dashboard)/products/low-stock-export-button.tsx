"use client";

import { Button } from "@paon/ui/components/Button";
import { useState } from "react";

import { getLowStockRows } from "./actions";

function toCsv(rows: Awaited<ReturnType<typeof getLowStockRows>>): string {
  const header = ["SKU", "Product", "Inventory quantity", "Product ID"];
  const escape = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  const lines = rows.map((row) =>
    [row.sku, row.productName, String(row.inventoryQuantity), row.productId]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function LowStockExportButton() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setError(null);
    try {
      const rows = await getLowStockRows();
      if (rows.length === 0) {
        setError("Nothing is currently at or below 5 units.");
        return;
      }
      const blob = new Blob([toCsv(rows)], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `low-stock-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not export low stock right now.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => void handleClick()}
      >
        {isPending ? "Preparing…" : "Export low stock CSV"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
