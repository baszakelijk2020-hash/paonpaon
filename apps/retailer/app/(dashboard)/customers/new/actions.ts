"use server";

import { requireRetailerRole } from "@paon/auth";
import { CustomerRepository } from "@paon/database";
import { createCustomerInputSchema } from "@paon/domain";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CreateCustomerFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
}

export const initialCreateCustomerFormState: CreateCustomerFormState = {
  values: {},
  fieldErrors: {},
};

export async function createCustomer(
  _prevState: CreateCustomerFormState,
  formData: FormData,
): Promise<CreateCustomerFormState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const parsed = createCustomerInputSchema.safeParse({
    fullName: raw["fullName"],
    email: raw["email"] || undefined,
    phone: raw["phone"] || undefined,
    lifecycleStage: raw["lifecycleStage"] || undefined,
    acquisitionSource: raw["acquisitionSource"] || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { values: raw, fieldErrors };
  }

  const supabase = await getSupabaseServerClient();

  const customer = await new CustomerRepository(supabase).create({
    retailerId: session.retailerId,
    fullName: parsed.data.fullName,
    ...(parsed.data.email ? { email: parsed.data.email } : {}),
    ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
    lifecycleStage: parsed.data.lifecycleStage,
    ...(parsed.data.acquisitionSource
      ? { acquisitionSource: parsed.data.acquisitionSource }
      : {}),
  });

  redirect(`/customers/${customer.id}`);
}
