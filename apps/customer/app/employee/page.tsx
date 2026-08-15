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
  wearerCustomerLinkState,
  type MeasurementValue,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate, formatMoney } from "@paon/utils";

import { AppointmentStatusBadge } from "../(dashboard)/appointments/status-badge";

import { RaiseRequestForm } from "./raise-request-form";
import { RequestAppointmentForm } from "./request-appointment-form";

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
 * page has always used for issue history. Published programme
 * announcements (migration 20260809220000) render whenever any exist —
 * RLS itself, not this page, is what keeps a wearer from ever seeing a
 * draft or another programme's news. A linked wearer can also request a
 * real appointment (migration 20260810100000,
 * `request_appointment_as_wearer`) — booked through their EXISTING
 * linked customer only, never fabricating a shadow one, preserving 18.6's
 * standing constraint against exactly that.
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

  const [programme, versions, issues, myRequests, announcements] =
    await Promise.all([
      repo.findProgrammeById(wearer.programmeId),
      repo.findEntitlementVersions(wearer.programmeId),
      repo.findIssuesByWearer(wearer.id),
      // RLS scopes this to the signed-in wearer's own rows only — the
      // wearer-select policy (18.8) is the only one their session
      // satisfies, so this never leaks a colleague's request.
      repo.findExceptionsByProgramme(wearer.programmeId),
      // RLS itself already restricts this to published announcements
      // for the caller's own programme — no extra filter needed here.
      repo.findPublishedAnnouncementsForProgramme(wearer.programmeId),
    ]);

  const linkedCustomerId = wearer.customerId;
  // Names the state the page already branches on. `wearerCustomerLinkState`
  // existed in @paon/domain, exported and unit-tested, with zero call sites —
  // the page hand-rolled the same distinction inline. PHASE 18.5's own
  // remaining-gap list calls wearer-initiated linking out explicitly; naming
  // the state here is the half that belongs to this app.
  const linkState = wearerCustomerLinkState({
    ...(linkedCustomerId ? { customerId: linkedCustomerId } : {}),
  });
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

      {announcements.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Announcements
          </h2>
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {announcements.map((announcement) => (
              <li key={announcement.id} className="flex flex-col gap-1 py-2">
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  {announcement.title}
                </p>
                <p className="text-sm text-[var(--color-stone-700)]">
                  {announcement.body}
                </p>
                {announcement.publishedAt ? (
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {formatDate(announcement.publishedAt, "en-US")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

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

      {linkState === "linked" ? (
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
            <RequestAppointmentForm />
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
      ) : (
        // Previously `null`: an unlinked wearer saw their entitlement and
        // announcements, then simply nothing where five sections would be,
        // with no indication anything was missing or why. Silence reads as a
        // broken portal. This states the actual situation instead.
        //
        // Deliberately NOT a self-service "link me" button. PHASE 18.5's own
        // remaining-gap list names wearer-initiated account creation as
        // unbuilt, and it needs a `security definer` RPC that does not exist
        // on main — building one here would be a new feature, and would sit
        // outside this task's owned paths. Linking today is staff-driven by
        // email, or automatic when the wearer already signs in with an
        // address that owns a customer record at the same retailer.
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Your personal records aren&rsquo;t connected yet
          </h2>
          <p className="text-sm text-[var(--color-stone-500)]">
            Your workwear entitlement and programme updates above are live.
            Appointments, orders, alterations, measurements and wardrobe stay
            hidden until your employer connects this login to your customer
            record — we never create one for you.
          </p>
          <p className="text-sm text-[var(--color-stone-500)]">
            Ask your programme manager to connect it, or sign in with the email
            address you already use as a customer of this retailer and it
            connects automatically.
          </p>
        </Card>
      )}

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
