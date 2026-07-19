import {
  AlterationRepository,
  CustomerRepository,
  PhysicalGarmentRepository,
} from "@paon/database";
import {
  retailerRoleHasAlterationsPermission,
  type Alteration,
} from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { AlterationStatusBadge } from "./status-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AlterationsPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const isWorker = session.retailerRole === "worker";
  const alterationRepository = new AlterationRepository(supabase);
  const alterations = isWorker
    ? await alterationRepository.findAssignedToWorker()
    : await alterationRepository.findByRetailer(session.retailerId);
  const customers = isWorker
    ? []
    : await new CustomerRepository(supabase).findByRetailer(session.retailerId);
  const customerNameById = new Map(
    customers.map((customer) => [customer.id, customer.fullName]),
  );
  const garments = isWorker
    ? []
    : await Promise.all(
        alterations.map((alteration) =>
          new PhysicalGarmentRepository(supabase).findById(
            alteration.physicalGarmentId,
          ),
        ),
      );
  const garmentById = new Map(
    garments
      .filter((garment) => garment !== null)
      .map((garment) => [garment.id, garment]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
            Alterations
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            {alterations.length} alteration
            {alterations.length === 1 ? "" : "s"}
          </p>
        </div>
        {retailerRoleHasAlterationsPermission(
          session.retailerRole,
          "intake",
        ) ? (
          <Link href="/alterations/new" className={buttonVariants()}>
            New alteration
          </Link>
        ) : null}
      </div>

      {alterations.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">No alterations yet.</p>
        </div>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {alterations.map((alteration) => {
            const garment = garmentById.get(alteration.physicalGarmentId);
            return (
              <Link
                key={alteration.id}
                href={`/alterations/${alteration.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-stone-50)]"
              >
                <div>
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {"customerId" in alteration
                      ? (customerNameById.get(
                          (alteration as Alteration).customerId,
                        ) ?? "Customer")
                      : "Assigned garment"}
                  </p>
                  <p className="text-sm text-[var(--color-stone-500)]">
                    {alteration.workOrderNumber} ·{" "}
                    {"garmentType" in alteration
                      ? `${alteration.brand ? `${alteration.brand} ` : ""}${alteration.garmentType}`
                      : `${garment?.brand ? `${garment.brand} ` : ""}${garment?.garmentType ?? "Garment"}`}
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {formatDate(alteration.createdAt, "en-US")}
                  </p>
                </div>
                <AlterationStatusBadge status={alteration.status} />
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
