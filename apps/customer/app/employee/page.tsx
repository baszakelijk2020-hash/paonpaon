import {
  AppointmentRepository,
  CorporateRepository,
  CustomerAlterationRepository,
  MeasurementMonitorRepository,
  OrderRepository,
  WardrobeRepository,
} from "@paon/database";
import {
  ALTERATION_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
  computeEntitlementBalance,
  ORDER_STATUS_LABELS,
  type MeasurementValue,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate, formatMoney } from "@paon/utils";

import { AppointmentStatusBadge } from "../(dashboard)/appointments/status-badge";

import { RaiseRequestForm } from "./raise-request-form";

import { requireWearerAppSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const KIND_LABELS: Record<string, string> = {
  damaged: "Damaged",
  missing: "Missing",
  fit_issue: "Fit issue",
  alteration_request: "Alteration request",
  replacement_request: "Replacement request",
  leaver_return: "Leaver return",
  service_required: "Service required",
  entitlement_dispute: "Entitlement dispute",
};

/**
 * The Employee Portal home (PHASE 18.5 / BD-105). Who the wearer is,
 * their programme, live entitlement balance and issue history — the
 * same `computeEntitlementBalance` the retailer-staff corporate page
 * already calls, never a second computation of the same number — plus
 * (PHASE 18.8) raising a service-desk request directly, the one owner-
 * boundary item from 18.5 the service desk unblocked.
 *
 * When a retailer has linked this wearer to a real Customer relationship
 * (`corporate_wearers.customer_id`, migrations 20260809200000/210000), the
 * wearer's own appointments, orders, alterations, latest approved
 * measurement version and active wardrobe pieces also render here —
 * through the exact same repositories and RLS boundary the customer-
 * facing dashboard already uses, never a duplicate read path. Unlinked
 * wearers see nothing for those sections (never a placeholder that looks
 * broken) — the same "show only what it can show honestly" posture this
 * page has always used for issue history. Announcements and write-
 * capable self-service (booking, not just reading) remain unbuilt.
 */
export default async function EmployeePortalPage() {
  const session = await requireWearerAppSession();
  const supabase = await getSupabaseServerClient();
  const repo = new CorporateRepository(supabase);

  const wearer = await repo.findWearerById(session.wearerId);
  if (!wearer) {
    return (
      <main className="mx-auto max-w-lg px-6 py-12">
        <p className="text-sm text-[var(--color-stone-700)]">
          Your employee record could not be found. Ask your programme
          administrator for help.
        </p>
      </main>
    );
  }

  const [programme, versions, issues, myRequests] = await Promise.all([
    repo.findProgrammeById(wearer.programmeId),
    repo.findEntitlementVersions(wearer.programmeId),
    repo.findIssuesByWearer(wearer.id),
    // RLS scopes this to the signed-in wearer's own rows only — the
    // wearer-select policy (18.8) is the only one their session
    // satisfies, so this never leaks a colleague's request.
    repo.findExceptionsByProgramme(wearer.programmeId),
  ]);

  const linkedCustomerId = wearer.customerId;
  const [appointments, orders, alterations, measurementVersion, wardrobeItems] =
    linkedCustomerId
      ? await Promise.all([
          new AppointmentRepository(supabase).findByCustomer(linkedCustomerId),
          new OrderRepository(supabase).findByCustomer(linkedCustomerId),
          new CustomerAlterationRepository(supabase).findByCustomer(
            linkedCustomerId,
          ),
          new MeasurementMonitorRepository(supabase).latestApprovedVersion({
            customerId: linkedCustomerId,
          }),
          new WardrobeRepository(supabase).findByCustomer(linkedCustomerId),
        ])
      : [[], [], [], null, []];
  const activeWardrobeItems = wardrobeItems.filter(
    (item) => item.condition !== "retired",
  );
  const latestVersion = versions[0] ?? null;
  const balances = latestVersion
    ? computeEntitlementBalance({
        version: {
          versionId: latestVersion.id,
          version: latestVersion.version,
          effectiveFrom: latestVersion.effectiveFrom,
          rules: latestVersion.rules,
        },
        roleKey: wearer.roleKey,
        joinedOn: wearer.joinedOn,
        issues,
        asOf: new Date().toISOString(),
      })
    : [];

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-12">
      <div>
        <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
          Employee Portal
        </p>
        <h1 className="font-display mt-1 text-3xl text-[var(--color-stone-900)]">
          {wearer.displayName}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          {programme?.name ?? "Programme"}
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Your entitlement
        </h2>
        {balances.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No entitlement policy is active yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {balances.map((balance) => (
              <li
                key={balance.garmentKey}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-[var(--color-stone-900)]">
                  {balance.garmentKey}
                </span>
                <span className="text-[var(--color-stone-500)]">
                  {balance.remainingQuantity}/{balance.entitledQuantity} left
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Issued to you
        </h2>
        {issues.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            Nothing issued yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {issues.map((issue) => (
              <li key={issue.id} className="py-2 text-sm">
                <span className="text-[var(--color-stone-900)]">
                  {issue.garmentKey}
                </span>{" "}
                <span className="text-[var(--color-stone-500)]">
                  ×{issue.quantity} — {issue.issuedOn}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {linkedCustomerId ? (
        <>
          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
              Your appointments
            </h2>
            {appointments.length === 0 ? (
              <p className="text-sm text-[var(--color-stone-500)]">
                No appointments yet.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
                {appointments.map((appointment) => (
                  <li
                    key={appointment.id}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div>
                      <p className="text-[var(--color-stone-900)]">
                        {APPOINTMENT_TYPE_LABELS[appointment.type]}
                      </p>
                      <p className="text-xs text-[var(--color-stone-500)]">
                        {formatDate(appointment.startsAt, "en-US")}
                      </p>
                    </div>
                    <AppointmentStatusBadge status={appointment.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
              Your orders
            </h2>
            {orders.length === 0 ? (
              <p className="text-sm text-[var(--color-stone-500)]">
                No orders yet.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
                {orders.map((order) => (
                  <li
                    key={order.id}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div>
                      <p className="text-[var(--color-stone-900)]">
                        {order.orderNumber}
                      </p>
                      <p className="text-xs text-[var(--color-stone-500)]">
                        {formatMoney(order.total, "en-US")}
                      </p>
                    </div>
                    <Badge tone="neutral">
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
              Your alterations
            </h2>
            {alterations.length === 0 ? (
              <p className="text-sm text-[var(--color-stone-500)]">
                No alterations yet.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
                {alterations.map((alteration) => (
                  <li
                    key={alteration.id}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div>
                      <p className="text-[var(--color-stone-900)]">
                        {alteration.garmentType}
                      </p>
                      {alteration.dueDate ? (
                        <p className="text-xs text-[var(--color-stone-500)]">
                          Due {formatDate(alteration.dueDate, "en-US")}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone="neutral">
                      {ALTERATION_STATUS_LABELS[alteration.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
              Your measurements
            </h2>
            {!measurementVersion ? (
              <p className="text-sm text-[var(--color-stone-500)]">
                No approved measurements on file yet.
              </p>
            ) : (
              <>
                <p className="text-xs text-[var(--color-stone-500)]">
                  Approved {formatDate(measurementVersion.approved_at, "en-US")}
                </p>
                <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
                  {(
                    measurementVersion.values as unknown as MeasurementValue[]
                  ).map((value) => (
                    <li
                      key={value.key}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="text-[var(--color-stone-900)]">
                        {value.key}
                      </span>
                      <span className="text-[var(--color-stone-500)]">
                        {value.millimetres} mm
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
              Your wardrobe
            </h2>
            {activeWardrobeItems.length === 0 ? (
              <p className="text-sm text-[var(--color-stone-500)]">
                No wardrobe pieces on file yet.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
                {activeWardrobeItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div>
                      <p className="text-[var(--color-stone-900)]">
                        {item.displayName}
                      </p>
                      {item.brand ? (
                        <p className="text-xs text-[var(--color-stone-500)]">
                          {item.brand}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone="neutral">{item.condition}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Report a problem
        </h2>
        {myRequests.length > 0 ? (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {myRequests.map((request) => (
              <li
                key={request.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <p className="text-[var(--color-stone-900)]">
                    {KIND_LABELS[request.kind] ?? request.kind}
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {request.detail}
                  </p>
                </div>
                <Badge tone={request.resolvedAt ? "success" : "neutral"}>
                  {request.resolvedAt ? "Resolved" : "Open"}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
        <RaiseRequestForm />
      </Card>
    </main>
  );
}
