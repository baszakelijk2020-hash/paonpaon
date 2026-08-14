import { CustomerRepository, StoreExperienceRepository } from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import { FeedbackCapture } from "./feedback-capture";
import {
  CloseSessionForm,
  OpenSessionForm,
  RecordComparisonForm,
} from "./store-session-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function StoreSessionsPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const store = new StoreExperienceRepository(supabase);

  const [sessions, customers] = await Promise.all([
    store.listSessions(session.retailerId),
    new CustomerRepository(supabase).findByRetailer(session.retailerId),
  ]);
  const customerNameById = new Map<string, string>(
    customers.map((customer) => [customer.id as string, customer.fullName]),
  );
  const customerOptions = customers.map((customer) => ({
    id: customer.id,
    label: customer.fullName,
  }));

  const comparisonsBySession = new Map(
    await Promise.all(
      sessions.map(
        async (item) =>
          [
            item.id,
            await store.listComparisonEntries({
              retailerId: session.retailerId,
              sessionId: item.id,
            }),
          ] as const,
      ),
    ),
  );

  const openSessions = sessions.filter((item) => !item.closedAt);
  const closedSessions = sessions.filter((item) => item.closedAt);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Store sessions
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Guided comparisons record what a customer preferred and why. A mirror
          or display failing mid-session is not an error — finishing on paper is
          just as valid, as long as it&apos;s recorded.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Open a session
        </h2>
        <div className="mt-3">
          <OpenSessionForm customers={customerOptions} />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Route in-store feedback
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          Send an explicit product or consented customer signal to the
          leadership audience responsible for follow-up. This does not track the
          employee who submitted it.
        </p>
        <div className="mt-3">
          <FeedbackCapture customers={customerOptions} />
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <h2 className="font-display text-xl text-[var(--color-stone-900)]">
          Open ({openSessions.length})
        </h2>
        {openSessions.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            Nothing open right now.
          </p>
        ) : (
          openSessions.map((item) => {
            const comparisons = comparisonsBySession.get(item.id) ?? [];
            return (
              <Card
                key={item.id}
                data-session-id={item.id}
                data-session-state="open"
              >
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  {item.customerId
                    ? (customerNameById.get(item.customerId) ?? "Customer")
                    : "Walk-in"}
                </p>
                <p className="text-xs text-[var(--color-stone-500)]">
                  Opened {formatDate(item.createdAt, "en-US")}
                </p>

                {comparisons.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1 text-xs text-[var(--color-stone-700)]">
                    {comparisons.map((entry) => (
                      <li key={entry.id} data-comparison-id={entry.id}>
                        {entry.constructionKind}
                        {entry.customerPreferred ? " — preferred" : ""}
                        {entry.notedReason ? `: ${entry.notedReason}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-3 border-t border-[var(--color-stone-200)] pt-3">
                  <RecordComparisonForm sessionId={item.id} />
                </div>
                <div className="mt-3 border-t border-[var(--color-stone-200)] pt-3">
                  <CloseSessionForm sessionId={item.id} />
                </div>
              </Card>
            );
          })
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-display text-xl text-[var(--color-stone-900)]">
          Closed ({closedSessions.length})
        </h2>
        {closedSessions.slice(0, 10).map((item) => (
          <Card
            key={item.id}
            data-session-id={item.id}
            data-session-state="closed"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--color-stone-900)]">
                {item.customerApprovedLookRef}
              </p>
              {item.deviceFailed ? (
                <Badge tone={item.manualFallbackUsed ? "warning" : "danger"}>
                  {item.manualFallbackUsed
                    ? "Finished on paper"
                    : "Device failed"}
                </Badge>
              ) : null}
            </div>
            {item.outcomeNote ? (
              <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                {item.outcomeNote}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-[var(--color-stone-500)]">
              Closed {item.closedAt ? formatDate(item.closedAt, "en-US") : ""}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
