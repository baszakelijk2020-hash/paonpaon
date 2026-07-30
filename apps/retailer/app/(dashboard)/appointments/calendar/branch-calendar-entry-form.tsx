"use client";

import type { BranchCalendarEntryType } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createBranchCalendarEntry } from "../../appointments/branch-calendar-actions";

export function BranchCalendarEntryForm({
  branchId,
  staffOptions,
  customerOptions,
}: {
  readonly branchId: string;
  readonly staffOptions: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly customerOptions: readonly {
    readonly id: string;
    readonly name: string;
  }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entryType, setEntryType] =
    useState<BranchCalendarEntryType>("coverage");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [staffId, setStaffId] = useState(staffOptions[0]?.id ?? "");
  const [customerId, setCustomerId] = useState(customerOptions[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createBranchCalendarEntry({
        branchId,
        entryType,
        title,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        ...(entryType === "coverage" && staffId
          ? { assignedStaffIds: [staffId] }
          : {}),
        ...(entryType === "recurring_moment" && customerId
          ? { customerId }
          : {}),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTitle("");
      router.refresh();
    });
  }

  return (
    <Card>
      <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
        Add calendar entry
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-[var(--color-stone-700)]">
          Type
          <select
            value={entryType}
            onChange={(event) =>
              setEntryType(event.target.value as BranchCalendarEntryType)
            }
            className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
          >
            <option value="coverage">Coverage shift</option>
            <option value="recurring_moment">Recurring customer moment</option>
            <option value="store_event">Store event</option>
            <option value="blocked">Blocked time</option>
          </select>
        </label>
        <label className="block text-sm text-[var(--color-stone-700)]">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm text-[var(--color-stone-700)]">
          Starts
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm text-[var(--color-stone-700)]">
          Ends
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
          />
        </label>
        {entryType === "coverage" ? (
          <label className="block text-sm text-[var(--color-stone-700)]">
            Assigned advisor
            <select
              value={staffId}
              onChange={(event) => setStaffId(event.target.value)}
              className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
            >
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {entryType === "recurring_moment" ? (
          <label className="block text-sm text-[var(--color-stone-700)]">
            Customer
            <select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
            >
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-[var(--color-danger-600)]">{error}</p>
      ) : null}
      <div className="mt-4">
        <Button
          type="button"
          onClick={onSubmit}
          disabled={pending || !title.trim() || !startsAt || !endsAt}
        >
          {pending ? "Saving…" : "Add entry"}
        </Button>
      </div>
    </Card>
  );
}
