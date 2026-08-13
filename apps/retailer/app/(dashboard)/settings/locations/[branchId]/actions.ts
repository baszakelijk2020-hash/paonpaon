"use server";

import { requireRetailerRole } from "@paon/auth";
import { RetailerBranchRepository } from "@paon/database";
import {
  asId,
  updateRetailerBranchLocationInputSchema,
  type BranchOpeningHoursEntry,
  type BranchContactAction,
  type BranchImage,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function updateBranchLocation(
  branchId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    throw new Error("Unauthorized");
  }

  const repository = new RetailerBranchRepository(
    await getSupabaseServerClient(),
  );

  // Verify the branch belongs to this retailer
  const branch = await repository.findById(
    session.retailerId,
    asId<"RetailerBranchId">(branchId),
  );
  if (!branch) {
    throw new Error("Branch not found");
  }

  // Parse opening hours from hidden JSON field
  const openingHoursJson = formData.get("openingHours");
  const openingHours = openingHoursJson
    ? (JSON.parse(String(openingHoursJson)) as BranchOpeningHoursEntry[])
    : [];

  // Parse contact actions from hidden JSON field
  const contactActionsJson = formData.get("contactActions");
  const contactActions = contactActionsJson
    ? (JSON.parse(String(contactActionsJson)) as BranchContactAction[])
    : [];

  // Parse imagery from hidden JSON field
  const imageryJson = formData.get("imagery");
  const imagery = imageryJson
    ? (JSON.parse(String(imageryJson)) as BranchImage[])
    : [];

  // Parse filter categories from comma-separated input
  const filterCategoriesStr = formData.get("filterCategories") as string;
  const filterCategories = filterCategoriesStr
    ? filterCategoriesStr
        .split(",")
        .map((cat) => cat.trim())
        .filter((cat) => cat.length > 0)
    : [];

  // Parse services from comma-separated input
  const servicesStr = formData.get("services") as string;
  const services = servicesStr
    ? servicesStr
        .split(",")
        .map((svc) => svc.trim())
        .filter((svc) => svc.length > 0)
    : [];

  // Parse latitude and longitude (the schema field is optional, not
  // nullable, so a blank input must become `undefined`, never `null`).
  const latStr = formData.get("latitude") as string;
  const lngStr = formData.get("longitude") as string;
  const latitude =
    latStr && !isNaN(parseFloat(latStr)) ? parseFloat(latStr) : undefined;
  const longitude =
    lngStr && !isNaN(parseFloat(lngStr)) ? parseFloat(lngStr) : undefined;

  // Parse published checkbox
  const published = formData.get("published") === "on";

  const values = updateRetailerBranchLocationInputSchema.parse({
    branchId,
    storeType:
      (formData.get("storeType") as string | null)?.trim() || undefined,
    addressLine1:
      (formData.get("addressLine1") as string | null)?.trim() || undefined,
    addressLine2:
      (formData.get("addressLine2") as string | null)?.trim() || undefined,
    city: (formData.get("city") as string | null)?.trim() || undefined,
    region: (formData.get("region") as string | null)?.trim() || undefined,
    postalCode:
      (formData.get("postalCode") as string | null)?.trim() || undefined,
    country: (formData.get("country") as string | null)?.trim() || undefined,
    latitude,
    longitude,
    phone: (formData.get("phone") as string | null)?.trim() || undefined,
    contactEmail:
      (formData.get("contactEmail") as string | null)?.trim() || undefined,
    openingHours,
    services,
    contactActions,
    filterCategories,
    imagery,
    presentationMode: (formData.get("presentationMode") as string) || "map",
    published,
  });

  await repository.updateLocationDetails(session.retailerId, values);

  revalidatePath(`/settings/locations/${branchId}`);
  revalidatePath("/settings/locations");
}
