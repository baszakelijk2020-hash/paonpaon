"use server";

import { requireAlterationsPermission } from "@paon/auth";
import {
  AlterationCatalogueRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { asId } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CatalogueActionState {
  formError?: string;
  success?: boolean;
}

function catalogueError(error: unknown): CatalogueActionState {
  return {
    formError:
      error instanceof Error ? error.message : "Unable to update catalogue.",
  };
}

export async function updateCategorySetting(
  _state: CatalogueActionState,
  formData: FormData,
): Promise<CatalogueActionState> {
  const session = await requireModuleSession("garment_service_operations");
  requireAlterationsPermission(session.retailerRole, "configure");
  const categoryId = formData.get("categoryId");
  if (typeof categoryId !== "string") {
    return { formError: "Category is required." };
  }
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  try {
    await new AlterationCatalogueRepository(supabase).setCategoryEnabled({
      retailerId: session.retailerId,
      categoryId,
      enabled: formData.get("enabled") === "true",
      ...(staff ? { staffId: staff.id } : {}),
    });
  } catch (error) {
    return catalogueError(error);
  }
  revalidatePath("/alterations/catalogue");
  return { success: true };
}

export async function updateOperationSetting(
  _state: CatalogueActionState,
  formData: FormData,
): Promise<CatalogueActionState> {
  const session = await requireModuleSession("garment_service_operations");
  requireAlterationsPermission(session.retailerRole, "configure");
  const operationId = formData.get("operationId");
  if (typeof operationId !== "string") {
    return { formError: "Operation is required." };
  }
  const rawPrice = formData.get("price");
  const amount =
    typeof rawPrice === "string" && rawPrice.trim()
      ? Number(rawPrice)
      : Number.NaN;
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  const repo = new AlterationCatalogueRepository(supabase);
  try {
    await repo.setOperationEnabled({
      retailerId: session.retailerId,
      operationId: asId<"AlterationOperationId">(operationId),
      enabled: formData.get("enabled") === "on",
      ...(staff ? { staffId: staff.id } : {}),
    });
    if (Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000) {
      await repo.setOperationPrice({
        operationId: asId<"AlterationOperationId">(operationId),
        amountMinorUnits: Math.round(amount * 100),
      });
    }
  } catch (error) {
    return catalogueError(error);
  }
  revalidatePath("/alterations/catalogue");
  return { success: true };
}

export async function updateWorkshopPrice(
  _state: CatalogueActionState,
  formData: FormData,
): Promise<CatalogueActionState> {
  const session = await requireModuleSession("garment_service_operations");
  requireAlterationsPermission(
    session.retailerRole,
    "manage_assigned_workshop",
  );
  const operationId = formData.get("operationId");
  const rawPrice = formData.get("price");
  const amount =
    typeof rawPrice === "string" && rawPrice.trim()
      ? Number(rawPrice)
      : Number.NaN;
  if (
    typeof operationId !== "string" ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 1_000_000
  )
    return {
      formError:
        "Operation and a price between zero and 1,000,000 are required.",
    };
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff?.workshopId) {
    return { formError: "Workshop assignment is required." };
  }
  try {
    await new AlterationCatalogueRepository(supabase).setOperationPrice({
      operationId: asId<"AlterationOperationId">(operationId),
      amountMinorUnits: Math.round(amount * 100),
      workshopId: staff.workshopId,
    });
  } catch (error) {
    return catalogueError(error);
  }
  revalidatePath("/alterations/catalogue");
  return { success: true };
}
