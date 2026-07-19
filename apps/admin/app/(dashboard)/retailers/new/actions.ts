"use server";

import { requirePlatformOperator } from "@paon/auth";
import {
  RetailerRepository,
  RetailerStaffRepository,
  SlugAlreadyExistsError,
  StaffEmailAlreadyInvitedError,
} from "@paon/database";
import { asId, createRetailerInputSchema, type UserId } from "@paon/domain";
import { stripUndefined } from "@paon/utils";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CreateRetailerFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
}

export const initialCreateRetailerFormState: CreateRetailerFormState = {
  values: {},
  fieldErrors: {},
};

export async function createRetailer(
  _prevState: CreateRetailerFormState,
  formData: FormData,
): Promise<CreateRetailerFormState> {
  const session = await getSession();
  requirePlatformOperator(session);

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const parsed = createRetailerInputSchema.safeParse({
    legalName: raw["legalName"],
    displayName: raw["displayName"],
    slug: raw["slug"],
    tier: raw["tier"],
    defaultCurrency: raw["defaultCurrency"],
    defaultLocale: raw["defaultLocale"],
    billingAddress: {
      line1: raw["billingLine1"],
      line2: raw["billingLine2"] || undefined,
      city: raw["billingCity"],
      region: raw["billingRegion"] || undefined,
      postalCode: raw["billingPostalCode"],
      countryCode: raw["billingCountryCode"],
    },
    ownerFullName: raw["ownerFullName"],
    ownerEmail: raw["ownerEmail"],
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
  const retailerRepo = new RetailerRepository(supabase);

  let retailerId: string;
  try {
    const retailer = await retailerRepo.create({
      legalName: parsed.data.legalName,
      displayName: parsed.data.displayName,
      slug: parsed.data.slug,
      tier: parsed.data.tier,
      defaultCurrency: parsed.data.defaultCurrency,
      defaultLocale: parsed.data.defaultLocale,
      billingAddress: stripUndefined(parsed.data.billingAddress),
    });
    retailerId = retailer.id;
  } catch (error) {
    if (error instanceof SlugAlreadyExistsError) {
      return { values: raw, fieldErrors: { slug: error.message } };
    }
    throw error;
  }

  const admin = getSupabaseAdminClient();
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(parsed.data.ownerEmail, {
      data: { full_name: parsed.data.ownerFullName },
    });

  if (inviteError || !invited.user) {
    return {
      values: raw,
      fieldErrors: {},
      formError: `Retailer created, but the owner invite failed: ${
        inviteError?.message ?? "unknown error"
      }. Find the retailer in the list and retry the invite from its detail page.`,
    };
  }

  const staffRepo = new RetailerStaffRepository(admin);
  try {
    await staffRepo.create({
      retailerId: asId<"RetailerId">(retailerId),
      userId: invited.user.id as UserId,
      fullName: parsed.data.ownerFullName,
      email: parsed.data.ownerEmail,
      role: "owner",
    });
  } catch (error) {
    if (error instanceof StaffEmailAlreadyInvitedError) {
      return { values: raw, fieldErrors: {}, formError: error.message };
    }
    throw error;
  }

  redirect(`/retailers/${retailerId}`);
}
