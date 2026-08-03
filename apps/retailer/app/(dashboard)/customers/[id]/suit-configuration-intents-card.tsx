import type { SuitConfigurationIntent } from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

const MODEL_NAMES: Record<number, string> = {
  1: "Henk",
  2: "Willem",
  3: "Karel",
};

function label(value: string): string {
  return value.replaceAll("_", " ");
}

/** FT-07 advisor-side visibility: the customer-facing configurator
 * (`/r/[slug]/configurator`) already saves each explored pick via
 * `save_suit_configuration_intent`; this reads it back through the same
 * repository method (`findRecentByCustomer`) that already existed but had
 * no caller — no new schema, RLS or RPC needed. */
export function SuitConfigurationIntentsCard({
  intents,
  customerId,
}: {
  intents: readonly SuitConfigurationIntent[];
  customerId: string;
}) {
  if (intents.length === 0) {
    return null;
  }

  return (
    <Card id="suit-configurator-intents" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Suit configurator picks
          </h2>
          <p className="text-sm text-[var(--color-stone-500)]">
            Design intent the client explored and saved in the online
            configurator — a starting point for the fitting conversation, not a
            confirmed order.
          </p>
        </div>
        <Link
          href={`/appointments/new?customerId=${customerId}`}
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          Book a fitting to discuss
        </Link>
      </div>
      <ul className="flex flex-col gap-3">
        {intents.map((intent) => (
          <li
            key={intent.id}
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--color-stone-900)]">
                {intent.modelPreset
                  ? (MODEL_NAMES[intent.modelPreset] ?? "Custom")
                  : "Custom"}
              </p>
              <p className="text-xs text-[var(--color-stone-500)]">
                {formatDate(intent.createdAt, "en-US")}
              </p>
            </div>
            <p className="mt-1 text-sm text-[var(--color-stone-700)]">
              {label(intent.lapel)} lapel · {label(intent.pockets)} pockets ·{" "}
              {label(intent.shoulder)} shoulder
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
