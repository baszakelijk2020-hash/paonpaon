import {
  RetailerStaffRepository,
  SupplierIntelligenceRepository,
} from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { formatDate } from "@paon/utils";

import {
  acknowledgeException,
  createComplaint,
  recordFact,
  upsertFabricButtonRule,
} from "./actions";
import {
  CreateExceptionForm,
  ResolveExceptionForm,
  TransitionComplaintForm,
} from "./supplier-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function SupplierIntelligencePage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const repo = new SupplierIntelligenceRepository(supabase);

  const [facts, rules, exceptions, complaints, staff] = await Promise.all([
    repo.findFactsByRetailer({ retailerId: session.retailerId }),
    repo.findFabricButtonRules({ retailerId: session.retailerId }),
    repo.findExceptions({ retailerId: session.retailerId }),
    repo.findComplaints({ retailerId: session.retailerId }),
    new RetailerStaffRepository(supabase).findByRetailer(session.retailerId),
  ]);

  const staffNameById = new Map<string, string>(
    staff.map((member) => [member.id as string, member.fullName]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Supplier intelligence
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Every fact below names who said it, which feed version, and when —
          there is no unattributed availability number here.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Log a supplier fact
        </h2>
        <form action={recordFact} className="mt-3 flex flex-col gap-4">
          <FormField htmlFor="kind" label="Kind">
            <Select id="kind" name="kind" required>
              <option value="material_availability">
                Material availability
              </option>
              <option value="trim_availability">Trim availability</option>
              <option value="lead_time_days">Lead time (days)</option>
              <option value="minimum_order_quantity">
                Minimum order quantity
              </option>
              <option value="price_minor_units">Price (minor units)</option>
              <option value="discontinued">Discontinued</option>
            </Select>
          </FormField>
          <FormField htmlFor="supplierKey" label="Supplier key">
            <Input id="supplierKey" name="supplierKey" type="text" required />
          </FormField>
          <FormField htmlFor="materialKey" label="Material key">
            <Input id="materialKey" name="materialKey" type="text" required />
          </FormField>
          <FormField htmlFor="value" label="Value">
            <Input id="value" name="value" type="text" required />
          </FormField>
          <FormField htmlFor="sourceAuthorityKey" label="Source authority">
            <Input
              id="sourceAuthorityKey"
              name="sourceAuthorityKey"
              type="text"
              required
            />
          </FormField>
          <FormField htmlFor="sourceVersion" label="Feed / document version">
            <Input
              id="sourceVersion"
              name="sourceVersion"
              type="text"
              required
            />
          </FormField>
          <FormField htmlFor="observedAt" label="Observed at">
            <Input
              id="observedAt"
              name="observedAt"
              type="datetime-local"
              required
            />
          </FormField>
          <div>
            <Button type="submit">Log fact</Button>
          </div>
        </form>

        <ul className="mt-4 flex flex-col gap-2 border-t border-[var(--color-stone-100)] pt-4">
          {facts.length === 0 ? (
            <p className="text-sm text-[var(--color-stone-500)]">
              No facts logged yet.
            </p>
          ) : (
            facts.map((fact) => (
              <li
                key={fact.id}
                className="text-sm text-[var(--color-stone-700)]"
              >
                <span className="font-medium text-[var(--color-stone-900)]">
                  {fact.material_key}
                </span>{" "}
                — {fact.kind} = {fact.value} · {fact.supplier_key} via{" "}
                {fact.source_authority_key} (v{fact.source_version}) ·{" "}
                {formatDate(fact.observed_at, "en-US")}
              </li>
            ))
          )}
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Fabric ↔ button rules
        </h2>
        <form
          action={upsertFabricButtonRule}
          className="mt-3 flex flex-col gap-4"
        >
          <FormField htmlFor="fabricKey" label="Fabric key">
            <Input id="fabricKey" name="fabricKey" type="text" required />
          </FormField>
          <FormField
            htmlFor="allowedButtonKeys"
            label="Allowed button keys (comma separated)"
          >
            <Input
              id="allowedButtonKeys"
              name="allowedButtonKeys"
              type="text"
              required
            />
          </FormField>
          <FormField htmlFor="note" label="Note">
            <Input id="note" name="note" type="text" required />
          </FormField>
          <div>
            <Button type="submit">Save rule</Button>
          </div>
        </form>
        <ul className="mt-4 flex flex-col gap-2 border-t border-[var(--color-stone-100)] pt-4">
          {rules.length === 0 ? (
            <p className="text-sm text-[var(--color-stone-500)]">
              No pairing rules yet — an unruled fabric is undecided, not
              allowed.
            </p>
          ) : (
            rules.map((rule) => (
              <li
                key={rule.id}
                className="text-sm text-[var(--color-stone-700)]"
              >
                <span className="font-medium text-[var(--color-stone-900)]">
                  {rule.fabric_key}
                </span>{" "}
                → {rule.allowed_button_keys.join(", ")}
                <span className="text-[var(--color-stone-500)]">
                  {" "}
                  — {rule.note}
                </span>
              </li>
            ))
          )}
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Supply exceptions (
          {exceptions.filter((e) => e.state !== "resolved").length} open)
        </h2>
        <CreateExceptionForm
          facts={facts.map((fact) => ({
            id: fact.id,
            materialKey: fact.material_key,
            kind: fact.kind,
            value: fact.value,
            sourceAuthorityKey: fact.source_authority_key,
          }))}
          staff={staff.map((member) => ({
            id: member.id as string,
            fullName: member.fullName,
          }))}
        />
        <ul className="mt-4 flex flex-col gap-4 border-t border-[var(--color-stone-100)] pt-4">
          {exceptions.length === 0 ? (
            <p className="text-sm text-[var(--color-stone-500)]">
              No exceptions recorded.
            </p>
          ) : (
            exceptions.map((exc) => (
              <li
                key={exc.id}
                data-exception-id={exc.id}
                className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {exc.material_key} — {exc.kind.replace(/_/g, " ")}
                  </p>
                  <ExceptionStateBadge state={exc.state} />
                </div>
                <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                  Owner: {staffNameById.get(exc.owner_staff_id) ?? "Unknown"}
                </p>
                <p className="mt-2 text-sm text-[var(--color-stone-700)]">
                  {exc.detail}
                </p>
                {exc.resolution_note ? (
                  <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                    Resolution: {exc.resolution_note}
                  </p>
                ) : null}
                {exc.state === "open" ? (
                  <form action={acknowledgeException} className="mt-2">
                    <input type="hidden" name="exceptionId" value={exc.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Acknowledge
                    </Button>
                  </form>
                ) : null}
                {exc.state !== "resolved" ? (
                  <ResolveExceptionForm exceptionId={exc.id} />
                ) : null}
              </li>
            ))
          )}
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Complaint cases (
          {complaints.filter((c) => c.state !== "closed").length} open)
        </h2>
        <form action={createComplaint} className="mt-3 flex flex-col gap-4">
          <FormField htmlFor="summary" label="Summary">
            <textarea
              id="summary"
              name="summary"
              required
              minLength={10}
              maxLength={4000}
              rows={3}
              className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-stone-400)]"
            />
          </FormField>
          <FormField htmlFor="supplierKey2" label="Supplier key (optional)">
            <Input id="supplierKey2" name="supplierKey" type="text" />
          </FormField>
          <FormField htmlFor="ownerStaffId2" label="Owner (optional)">
            <Select id="ownerStaffId2" name="ownerStaffId">
              <option value="">Unassigned</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id as string}>
                  {member.fullName}
                </option>
              ))}
            </Select>
          </FormField>
          <div>
            <Button type="submit">Log complaint</Button>
          </div>
        </form>
        <ul className="mt-4 flex flex-col gap-4 border-t border-[var(--color-stone-100)] pt-4">
          {complaints.length === 0 ? (
            <p className="text-sm text-[var(--color-stone-500)]">
              No complaint cases yet.
            </p>
          ) : (
            complaints.map((complaint) => (
              <li
                key={complaint.id}
                data-complaint-id={complaint.id}
                className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {complaint.summary}
                  </p>
                  <ComplaintStateBadge state={complaint.state} />
                </div>
                {complaint.evidence_refs.length > 0 ? (
                  <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                    Evidence: {complaint.evidence_refs.join(", ")}
                  </p>
                ) : null}
                {complaint.customer_recovery_note ? (
                  <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                    Customer recovery: {complaint.customer_recovery_note}
                  </p>
                ) : null}
                {complaint.outcome_note ? (
                  <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                    Outcome: {complaint.outcome_note}
                  </p>
                ) : null}
                <TransitionComplaintForm
                  complaintId={complaint.id}
                  state={complaint.state}
                />
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}

function ExceptionStateBadge({ state }: { readonly state: string }) {
  if (state === "resolved") return <Badge tone="success">Resolved</Badge>;
  if (state === "acknowledged")
    return <Badge tone="warning">Acknowledged</Badge>;
  return <Badge tone="danger">Open</Badge>;
}

function ComplaintStateBadge({ state }: { readonly state: string }) {
  if (state === "closed") return <Badge tone="success">Closed</Badge>;
  if (state === "customer_recovered")
    return <Badge tone="warning">Customer recovered</Badge>;
  if (state === "supplier_notified")
    return <Badge tone="warning">Supplier notified</Badge>;
  if (state === "investigating")
    return <Badge tone="warning">Investigating</Badge>;
  return <Badge tone="danger">Raised</Badge>;
}
