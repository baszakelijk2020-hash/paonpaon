"use client";

import { Button } from "@paon/ui/components/Button";

export function ExportCsvButton({
  rows,
  since,
}: {
  rows: [label: string, value: string][];
  since: string;
}) {
  function handleClick() {
    const header = ["Metric", "Value"];
    const escape = (value: string) =>
      /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
    const csv = [
      header.join(","),
      ...rows.map((row) => row.map(escape).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `paon-analytics-since-${since}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick}>
      Export CSV
    </Button>
  );
}
