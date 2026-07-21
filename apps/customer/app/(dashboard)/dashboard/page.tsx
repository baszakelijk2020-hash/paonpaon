import {
  AppointmentRepository,
  CustomerRepository,
  NotificationRepository,
  OrderRepository,
  RetailerRepository,
} from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { TodaysPick } from "./todays-pick";

import { getAIProvider } from "@/lib/ai";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const appointmentRepo = new AppointmentRepository(supabase);
  const orderRepo = new OrderRepository(supabase);
  const relationships = await Promise.all(
    customers.map(async (customer) => {
      const [retailer, appointments, orders] = await Promise.all([
        retailerRepo.findById(customer.retailerId),
        appointmentRepo.findByCustomer(customer.id),
        orderRepo.findByCustomer(customer.id),
      ]);
      const now = Date.now();
      const nextAppointment = appointments
        .filter(
          (appointment) =>
            !["completed", "canceled", "no_show"].includes(
              appointment.status,
            ) && new Date(appointment.startsAt).getTime() >= now,
        )
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )[0];
      const orderAwaitingPayment = orders.find(
        (order) => order.status === "pending_payment",
      );
      return { customer, retailer, nextAppointment, orderAwaitingPayment };
    }),
  );
  const notifications = await new NotificationRepository(supabase).findByUser(
    session.userId,
  );
  const unreadByRetailer = new Map<string, number>();
  for (const notification of notifications) {
    if (notification.readAt) continue;
    unreadByRetailer.set(
      notification.retailerId,
      (unreadByRetailer.get(notification.retailerId) ?? 0) + 1,
    );
  }
  const aiConfigured = !!getAIProvider();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-[var(--font-display)] text-[var(--color-stone-900)]">
          Your relationships
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          {relationships.length} retailer
          {relationships.length === 1 ? "" : "s"}
        </p>
      </div>

      {relationships.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            You don&rsquo;t have any retailer relationships yet. Once a retailer
            you&rsquo;ve shopped with adds you as a client (or you place an
            order once storefronts are live), it&rsquo;ll show up here.
          </p>
        </div>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {relationships.map(
            ({ customer, retailer, nextAppointment, orderAwaitingPayment }) => {
              const unread = unreadByRetailer.get(customer.retailerId) ?? 0;
              const hasUpdate =
                !!nextAppointment || !!orderAwaitingPayment || unread > 0;
              return (
                <div key={customer.id}>
                  <div className="px-6 py-4">
                    <p className="font-medium text-[var(--color-stone-900)]">
                      {retailer?.displayName ?? "Unknown retailer"}
                    </p>
                    <p className="text-sm capitalize text-[var(--color-stone-500)]">
                      {customer.lifecycleStage.replaceAll("_", " ")}
                    </p>
                    {hasUpdate ? (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {orderAwaitingPayment ? (
                          <Link
                            href={`/orders/${orderAwaitingPayment.id}`}
                            className="font-medium text-[var(--color-danger-500)] hover:underline"
                          >
                            Order awaiting payment →
                          </Link>
                        ) : null}
                        {nextAppointment ? (
                          <Link
                            href={`/appointments/${nextAppointment.id}`}
                            className="text-[var(--color-stone-700)] hover:underline"
                          >
                            Next appointment{" "}
                            {formatDate(nextAppointment.startsAt, "en-US")} →
                          </Link>
                        ) : null}
                        {unread > 0 ? (
                          <Link
                            href="/messages"
                            className="text-[var(--color-stone-700)] hover:underline"
                          >
                            {unread} unread message{unread === 1 ? "" : "s"} →
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {aiConfigured && retailer ? (
                    <TodaysPick
                      slug={retailer.slug}
                      retailerId={retailer.id}
                      customerId={customer.id}
                      retailerName={retailer.displayName}
                      customerName={customer.fullName}
                    />
                  ) : null}
                </div>
              );
            },
          )}
        </Card>
      )}

      {!aiConfigured ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          Personalised picks are not configured on this deployment.
        </p>
      ) : null}
    </div>
  );
}
