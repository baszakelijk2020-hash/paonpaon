import { requireAlterationsPermission } from "@paon/auth";
import {
  AlterationCatalogueRepository,
  CustomerRepository,
  OrderRepository,
} from "@paon/database";
import { redirect } from "next/navigation";

import { AlterationForm } from "./alteration-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function NewAlterationPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; appointmentId?: string }>;
}) {
  const session = await requireSession();
  try {
    requireAlterationsPermission(session.retailerRole, "intake");
  } catch {
    redirect("/alterations");
  }

  const { customerId, appointmentId } = await searchParams;
  const supabase = await getSupabaseServerClient();
  const [customers, catalogue, orders] = await Promise.all([
    new CustomerRepository(supabase).findByRetailer(session.retailerId),
    new AlterationCatalogueRepository(supabase).findForRetailer(
      session.retailerId,
    ),
    new OrderRepository(supabase).findByRetailer(session.retailerId),
  ]);
  const orderRepository = new OrderRepository(supabase);
  const lines = await Promise.all(
    orders.map(async (order) =>
      (await orderRepository.findLinesByOrder(order.id)).map((line) => ({
        order,
        line,
      })),
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
          New alteration intake
        </h1>
      </div>
      <AlterationForm
        customers={customers}
        categories={catalogue.categories}
        operations={catalogue.operations}
        orderLines={lines.flat()}
        {...(customerId ? { defaultCustomerId: customerId } : {})}
        {...(appointmentId ? { defaultAppointmentId: appointmentId } : {})}
      />
    </div>
  );
}
