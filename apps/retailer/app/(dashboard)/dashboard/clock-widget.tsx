import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";

import { clockIn, clockOut } from "../staff/roster/actions";

export function ClockWidget({ clockedInAt }: { clockedInAt?: string }) {
  return (
    <Card className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
          Your shift
        </p>
        <p className="text-sm text-[var(--color-stone-700)]">
          {clockedInAt
            ? `Clocked in at ${new Date(clockedInAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
            : "Not clocked in"}
        </p>
      </div>
      <form action={clockedInAt ? clockOut : clockIn}>
        <button
          type="submit"
          className={buttonVariants({
            variant: clockedInAt ? "outline" : "primary",
            size: "sm",
          })}
        >
          {clockedInAt ? "Clock out" : "Clock in"}
        </button>
      </form>
    </Card>
  );
}
