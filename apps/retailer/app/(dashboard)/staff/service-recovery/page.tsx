import {
  CustomerRepository,
  InternalCommunityRepository,
  OrderRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { retailerRoleAtLeast, type CurrencyCode } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatMoney } from "@paon/utils";

import { DecideBudgetForm, RequestBudgetForm } from "./recovery-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ServiceRecoveryPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const staffRepo = new RetailerStaffRepository(supabase);
  const communityRepo = new InternalCommunityRepository(supabase);
  const viewer = await staffRepo.findByUserId(session.userId);

  if (!viewer) {
    return (
      <div className="flex flex-col gap-6">
        <Heading />
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            Your staff record could not be found.
          </p>
        </Card>
      </div>
    );
  }

  const isManager = retailerRoleAtLeast(session.retailerRole, "manager");

  const [requests, customers, orders, team] = await Promise.all([
    communityRepo.listBudgetRequests({ retailerId: session.retailerId }),
    new CustomerRepository(supabase).findByRetailer(session.retailerId),
    new OrderRepository(supabase).findByRetailer(session.retailerId),
    staffRepo.findByRetailer(session.retailerId),
  ]);

  const customerNameById = new Map<string, string>(
    customers.map((c) => [c.id as string, c.fullName]),
  );
  const orderNumberById = new Map<string, string>(
    orders.map((o) => [o.id as string, o.orderNumber]),
  );
  const staffNameById = new Map<string, string>(
    team.map((m) => [m.id as string, m.fullName]),
  );

  return (
    <div className="flex flex-col gap-6">
      <Heading />

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Request an authorised spend
        </h2>
        <RequestBudgetForm
          customers={customers.map((c) => ({
            id: c.id as string,
            fullName: c.fullName,
          }))}
          orders={orders.map((o) => ({
            id: o.id as string,
            orderNumber: o.orderNumber,
          }))}
        />
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Requests ({requests.length})
        </h2>
        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            Nothing here yet — this list shows your own requests, and every
            request if you&apos;re a manager.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {requests.map((r) => (
              <li
                key={r.id}
                data-request-id={r.id}
                className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {formatMoney(
                      {
                        amountMinorUnits: r.amount_minor_units,
                        currency: r.currency as CurrencyCode,
                      },
                      "en-US",
                    )}{" "}
                    — {staffNameById.get(r.requested_by_staff_id) ?? "Unknown"}
                  </p>
                  <StateBadge state={r.state} />
                </div>
                <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                  {r.customer_id
                    ? `Client: ${customerNameById.get(r.customer_id) ?? "Unknown"}`
                    : null}
                  {r.order_id
                    ? `Order: ${orderNumberById.get(r.order_id) ?? "Unknown"}`
                    : null}
                </p>
                <p className="mt-2 text-sm text-[var(--color-stone-700)]">
                  {r.reason}
                </p>
                {r.decision_note ? (
                  <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                    Decision note: {r.decision_note}
                  </p>
                ) : null}
                {isManager && r.state === "requested" ? (
                  <DecideBudgetForm requestId={r.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Heading() {
  return (
    <div>
      <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
        Service recovery
      </h1>
      <p className="text-sm text-[var(--color-stone-500)]">
        Request and approve an authorised spend — this records an authorisation
        only, no payment is made here.
      </p>
    </div>
  );
}

function StateBadge({ state }: { readonly state: string }) {
  if (state === "approved") return <Badge tone="success">Approved</Badge>;
  if (state === "declined") return <Badge tone="danger">Declined</Badge>;
  if (state === "spent") return <Badge tone="neutral">Spent</Badge>;
  return <Badge tone="warning">Requested</Badge>;
}
