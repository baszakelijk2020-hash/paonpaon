"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  AIGenerationRepository,
  AnalyticsRepository,
  ClientelingRepository,
  CustomerRepository,
  OrderRepository,
  RetailerRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  asId,
  createClientelingNoteSchema,
  PREFERRED_CARRIERS,
  type PreferredCarrier,
} from "@paon/domain";
import { formatMoney } from "@paon/utils";
import { revalidatePath } from "next/cache";

import { getAIProvider } from "@/lib/ai";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface AIActionState {
  formError?: string;
  result?: { action: string; rationale: string };
}

/** Founder decision: OpenAI behind @paon/ai's provider-neutral interface — see docs/DECISIONS.md ADR-033. */
export async function generateNextBestAction(
  customerId: string,
  _previous: AIActionState,
  _formData: FormData,
): Promise<AIActionState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");

  const provider = getAIProvider();
  if (!provider) {
    return {
      formError:
        'AI is not configured on this deployment — see docs/PROJECT_STATE.md "Credentials needed".',
    };
  }

  const client = await getSupabaseServerClient();
  const customer = await new CustomerRepository(client).findById(
    asId<"CustomerId">(customerId),
  );
  if (!customer || customer.retailerId !== session.retailerId) {
    return { formError: "Customer not found." };
  }

  const [retailer, staff, events, orders] = await Promise.all([
    new RetailerRepository(client).findById(session.retailerId),
    new RetailerStaffRepository(client).findByUserId(session.userId),
    new AnalyticsRepository(client).findRecentByCustomer(
      session.retailerId,
      customer.id,
      10,
    ),
    new OrderRepository(client).findByCustomer(customer.id),
  ]);

  const context = {
    retailerName: retailer?.displayName ?? "the retailer",
    customerName: customer.fullName,
    lifecycleStage: customer.lifecycleStage,
    recentEventNames: events.map((event) => event.name),
    recentOrderSummaries: orders
      .slice(0, 5)
      .map(
        (order) =>
          `${order.orderNumber}: ${formatMoney(order.total, "en-US")} (${order.status})`,
      ),
  };
  const inputSummary = `customer=${customer.fullName} events=${context.recentEventNames.length} orders=${context.recentOrderSummaries.length}`;

  const generationRepo = new AIGenerationRepository(client);
  const startedAt = Date.now();

  try {
    const result = await provider.generateNextBestAction(context);
    await generationRepo.record({
      retailerId: session.retailerId,
      customerId: customer.id,
      ...(staff ? { requestedByStaffId: staff.id } : {}),
      kind: "next_best_action",
      status: "succeeded",
      provider: provider.providerName,
      model: provider.model,
      inputSummary,
      output: { action: result.action, rationale: result.rationale },
      latencyMs: Date.now() - startedAt,
    });
    revalidatePath(`/customers/${customerId}`);
    return { result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI generation failed";
    await generationRepo.record({
      retailerId: session.retailerId,
      customerId: customer.id,
      ...(staff ? { requestedByStaffId: staff.id } : {}),
      kind: "next_best_action",
      status: "failed",
      provider: provider.providerName,
      model: provider.model,
      inputSummary,
      errorMessage: message,
      latencyMs: Date.now() - startedAt,
    });
    revalidatePath(`/customers/${customerId}`);
    return { formError: message };
  }
}

/** Retailer-staff-set — no live carrier API, this only records which
 * carrier/pickup arrangement staff intend to use for this customer,
 * shown alongside their shipping addresses. */
export async function setPreferredCarrier(formData: FormData) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");
  const customerId = String(formData.get("customerId"));
  const raw = String(formData.get("carrier") ?? "");
  const carrier: PreferredCarrier | null = (
    PREFERRED_CARRIERS as readonly string[]
  ).includes(raw)
    ? (raw as PreferredCarrier)
    : null;

  const client = await getSupabaseServerClient();
  const customer = await new CustomerRepository(client).findById(
    asId<"CustomerId">(customerId),
  );
  if (!customer || customer.retailerId !== session.retailerId) {
    throw new Error("Customer not found.");
  }
  await new CustomerRepository(client).updatePreferredCarrier(
    customer.id,
    carrier,
  );
  revalidatePath(`/customers/${customerId}`);
}

export async function createClientelingNote(formData: FormData) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");
  const value = createClientelingNoteSchema.parse({
    customerId: formData.get("customerId"),
    body: formData.get("body"),
    pinned: formData.get("pinned") === "on",
  });
  const client = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(client).findByUserId(
    session.userId,
  );
  if (!staff || staff.retailerId !== session.retailerId)
    throw new Error("Active staff membership required");
  await new ClientelingRepository(client).create({
    retailerId: session.retailerId,
    customerId: value.customerId as never,
    authorStaffId: staff.id,
    body: value.body,
    pinned: value.pinned,
  });
  revalidatePath(`/customers/${value.customerId}`);
}
