import { CustomerRepository, PhysicalGarmentRepository } from "@paon/database";
import { asId, retailerRoleAtLeast } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LifecycleBadge } from "../lifecycle-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const customer = await new CustomerRepository(supabase).findById(
    asId<"CustomerId">(id),
  );

  if (!customer) {
    notFound();
  }

  const garments = await new PhysicalGarmentRepository(supabase).findByCustomer(
    customer.id,
  );
  const canManage = retailerRoleAtLeast(
    session.retailerRole,
    "sales_associate",
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
              {customer.fullName}
            </h1>
            <LifecycleBadge stage={customer.lifecycleStage} />
          </div>
          <p className="text-sm text-[var(--color-stone-500)]">
            {customer.email ?? "No email on file"}
            {customer.phone ? ` · ${customer.phone}` : ""}
          </p>
        </div>
        {canManage ? (
          <Link
            href={`/alterations/new?customerId=${customer.id}`}
            className={buttonVariants({ variant: "secondary" })}
          >
            New alteration
          </Link>
        ) : null}
      </div>

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Customer Portal
          </p>
          <Badge tone={customer.userId ? "success" : "neutral"}>
            {customer.userId ? "Linked" : "Not linked"}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Acquisition source
          </p>
          <p className="text-[var(--color-stone-900)]">
            {customer.acquisitionSource ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Added
          </p>
          <p className="text-[var(--color-stone-900)]">
            {formatDate(customer.createdAt, "en-US")}
          </p>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Garments & fitting history
        </h2>
        {garments.length === 0 ? (
          <p className="mb-4 text-sm text-[var(--color-stone-500)]">
            No physical garments have been recorded yet. Fit observations are
            captured during garment intake, never as generic customer
            measurements.
          </p>
        ) : (
          <Card className="mb-4 divide-y divide-[var(--color-stone-100)] p-0">
            {garments.map((garment) => (
              <div key={garment.id} className="px-6 py-4">
                <p className="text-xs text-[var(--color-stone-500)]">
                  {formatDate(garment.createdAt, "en-US")} ·{" "}
                  {garment.categoryCode}
                </p>
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  {garment.brand ? `${garment.brand} ` : ""}
                  {garment.garmentType}
                </p>
                <p className="text-sm text-[var(--color-stone-700)]">
                  {garment.description}
                </p>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
