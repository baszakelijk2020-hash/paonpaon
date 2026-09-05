"use client";

import type { ConversationProposal, CurrencyCode } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { formatDate, formatMoney } from "@paon/utils";

export function ProposalDisplay({
  proposal,
}: {
  readonly proposal: ConversationProposal;
}) {
  const statusTone =
    proposal.status === "accepted"
      ? "success"
      : proposal.status === "declined"
        ? "danger"
        : "neutral";

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-[var(--color-stone-900)]">
            {proposal.title}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-stone-600)]">
            {proposal.advisorNote}
          </p>
        </div>
        <Badge tone={statusTone}>{proposal.status}</Badge>
      </div>

      {proposal.items.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
            Items
          </p>
          <div className="mt-1 space-y-1">
            {proposal.items.map((item, idx) => (
              <div key={idx} className="text-sm text-[var(--color-stone-700)]">
                <strong>{item.label}</strong>
                {item.description ? (
                  <p className="text-xs text-[var(--color-stone-600)]">
                    {item.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {proposal.alternatives.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
            Alternatives
          </p>
          <div className="mt-1 space-y-1">
            {proposal.alternatives.map((item, idx) => (
              <div key={idx} className="text-sm text-[var(--color-stone-700)]">
                <strong>{item.label}</strong>
                {item.description ? (
                  <p className="text-xs text-[var(--color-stone-600)]">
                    {item.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-3">
        {proposal.priceMinorUnits !== undefined && proposal.priceCurrency ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
              Price
            </p>
            <p className="text-sm font-medium text-[var(--color-stone-900)]">
              {formatMoney(
                {
                  amountMinorUnits: proposal.priceMinorUnits,
                  currency: proposal.priceCurrency as CurrencyCode,
                },
                "en-US",
              )}
            </p>
          </div>
        ) : null}

        {proposal.appointmentOffered ? (
          <div>
            <Badge tone="neutral">Appointment offered</Badge>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-stone-500)]">
        <div>
          <p className="font-medium uppercase tracking-wide">Expires</p>
          <p>{formatDate(proposal.expiresAt, "en-US")}</p>
        </div>
        {proposal.respondedAt ? (
          <div>
            <p className="font-medium uppercase tracking-wide">Responded</p>
            <p>
              {formatDate(proposal.respondedAt, "en-US")} —{" "}
              <span className="capitalize">{proposal.response}</span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
