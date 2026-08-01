"use server";

import { requireRetailerRole } from "@paon/auth";
import { CustomerRepository } from "@paon/database";
import { createCustomerInputSchema } from "@paon/domain";
import { redirect } from "next/navigation";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CreateCustomerFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
}

export async function createCustomer(
  _prevState: CreateCustomerFormState,
  formData: FormData,
): Promise<CreateCustomerFormState> {
  const session = await requireModuleSession("relationship_intelligence");
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
  const existing = await new CustomerRepository(supabase).findByRetailer(
    session.retailerId,
  );
  const email = parsed.data.email?.trim().toLowerCase();
  const phone = parsed.data.phone?.replace(/\s+/g, "");
  const duplicate = existing.find((customer) => {
    if (email && customer.email?.trim().toLowerCase() === email) return true;
    if (phone && customer.phone?.replace(/\s+/g, "") === phone) return true;
    return false;
  });
  if (duplicate) {
    return {
      values: raw,
      fieldErrors: {},
      formError: `A client already exists with that contact (${duplicate.fullName}). Open their record instead of creating a duplicate.`,
    };
  }

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
