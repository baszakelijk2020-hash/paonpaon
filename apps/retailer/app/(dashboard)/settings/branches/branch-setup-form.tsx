"use client";

import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createBranch } from "../branch-calendar-actions";

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Amsterdam",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
] as const;

export function BranchSetupForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState<string>("America/New_York");
  const [isPrimary, setIsPrimary] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createBranch({ name, timezone, isPrimary });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      router.refresh();
    });
  }

  return (
    <Card>
      <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
        Add branch
      </h2>
      <p className="mt-1 text-sm text-[var(--color-stone-500)]">
        Each branch carries an IANA timezone so shared calendar times display
        honestly for floor staff.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-[var(--color-stone-700)]">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
            placeholder="Madison Avenue salon"
          />
        </label>
        <label className="block text-sm text-[var(--color-stone-700)]">
          Timezone
          <select
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
          >
            {COMMON_TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm text-[var(--color-stone-700)]">
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(event) => setIsPrimary(event.target.checked)}
        />
        Primary branch
      </label>
      {error ? (
        <p className="mt-2 text-sm text-[var(--color-danger-600)]">{error}</p>
      ) : null}
      <div className="mt-4">
        <Button type="button" onClick={onSubmit} disabled={pending || !name.trim()}>
          {pending ? "Saving…" : "Create branch"}
        </Button>
      </div>
    </Card>
  );
}
