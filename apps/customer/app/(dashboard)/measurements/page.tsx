import {
  CustomerRepository,
  MeasurementMonitorRepository,
} from "@paon/database";

import { MeasurementCaptureForm } from "./measurement-capture-form";
import { ReorderGateStatus } from "./reorder-gate-status";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function MeasurementsPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  // Get the customer for this user. The customer app may have multiple
  // customers (one per retailer); use the first one.
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  if (customers.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="font-display text-4xl text-[var(--color-stone-900)]">
          Your measurements
        </h1>
        <p className="text-sm text-[var(--color-stone-600)]">
          Customer record not found.
        </p>
      </div>
    );
  }
  const customer = customers[0]!;

  const repo = new MeasurementMonitorRepository(supabase);
  const gateResult = await repo.checkReorderAllowed({
    customerId: customer.id,
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-4xl text-[var(--color-stone-900)]">
          Your measurements
        </h1>
        <p className="mt-2 text-sm text-[var(--color-stone-600)]">
          Manage your body measurements for made-to-measure garments.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_0.6fr]">
        <MeasurementCaptureForm />

        <div>
          <ReorderGateStatus
            allowed={gateResult.allowed}
            reason={gateResult.reason}
          />
        </div>
      </div>
    </div>
  );
}
