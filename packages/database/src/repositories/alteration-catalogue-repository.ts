import {
  asId,
  money,
  type AlterationCatalogueCategory,
  type AlterationOperation,
  type AlterationOperationId,
  type GarmentCategoryCode,
  type RetailerId,
  type StaffId,
  type WorkshopId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

export interface AlterationCatalogue {
  categories: AlterationCatalogueCategory[];
  operations: AlterationOperation[];
}

export class AlterationCatalogueRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findForRetailer(
    retailerId: RetailerId,
    workshopId?: WorkshopId,
  ): Promise<AlterationCatalogue> {
    const today = new Date().toISOString().slice(0, 10);
    let priceListQuery = this.client
      .from("alteration_price_lists")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("kind", workshopId ? "workshop" : "retailer")
      .eq("active", true)
      .is("deleted_at", null)
      .lte("effective_from", today)
      .or(`effective_until.is.null,effective_until.gte.${today}`)
      .order("effective_from", { ascending: false })
      .limit(1);
    priceListQuery = workshopId
      ? priceListQuery.eq("workshop_id", workshopId)
      : priceListQuery.is("workshop_id", null);
    const [
      categoriesResult,
      operationsResult,
      categorySettingsResult,
      operationSettingsResult,
      listsResult,
    ] = await Promise.all([
      this.client
        .from("alteration_catalogue_categories")
        .select("*")
        .eq("active", true)
        .order("display_order", { ascending: true }),
      this.client
        .from("alteration_operations")
        .select("*")
        .eq("active", true)
        .order("display_order", { ascending: true }),
      this.client
        .from("retailer_alteration_category_settings")
        .select("*")
        .eq("retailer_id", retailerId),
      this.client
        .from("retailer_alteration_operation_settings")
        .select("*")
        .eq("retailer_id", retailerId),
      priceListQuery,
    ]);

    for (const result of [
      categoriesResult,
      operationsResult,
      categorySettingsResult,
      operationSettingsResult,
      listsResult,
    ]) {
      if (result.error) throw result.error;
    }

    const categoryEnabled = new Map(
      (categorySettingsResult.data ?? []).map((setting) => [
        setting.category_id,
        setting.enabled,
      ]),
    );
    const operationEnabled = new Map(
      (operationSettingsResult.data ?? []).map((setting) => [
        setting.operation_id,
        setting.enabled,
      ]),
    );
    const priceList = (listsResult.data ?? [])[0];
    const priceByOperation = new Map<
      string,
      { amount: number; currency: string }
    >();
    if (priceList) {
      const { data, error } = await this.client
        .from("alteration_price_list_items")
        .select("*")
        .eq("price_list_id", priceList.id);
      if (error) throw error;
      for (const item of data) {
        priceByOperation.set(item.operation_id, {
          amount: item.amount_minor_units,
          currency: item.currency,
        });
      }
    }

    return {
      categories: (categoriesResult.data ?? []).map((row) => ({
        id: asId<"AlterationCategoryId">(row.id),
        code: row.code as GarmentCategoryCode,
        name: row.name,
        description: row.description,
        displayOrder: row.display_order,
        enabled: categoryEnabled.get(row.id) ?? true,
      })),
      operations: (operationsResult.data ?? []).map((row) => {
        const price = priceByOperation.get(row.id);
        return {
          id: asId<"AlterationOperationId">(row.id),
          categoryId: asId<"AlterationCategoryId">(row.category_id),
          code: row.code,
          name: row.name,
          description: row.description,
          ...(row.default_duration_minutes !== null
            ? { defaultDurationMinutes: row.default_duration_minutes }
            : {}),
          enabled: operationEnabled.get(row.id) ?? true,
          ...(price
            ? {
                effectivePrice: money(
                  price.amount,
                  price.currency as Parameters<typeof money>[1],
                ),
              }
            : {}),
        };
      }),
    };
  }

  async setCategoryEnabled(params: {
    retailerId: RetailerId;
    categoryId: string;
    enabled: boolean;
    staffId?: StaffId;
  }): Promise<void> {
    const { error } = await this.client
      .from("retailer_alteration_category_settings")
      .upsert({
        retailer_id: params.retailerId,
        category_id: params.categoryId,
        enabled: params.enabled,
        updated_by_staff_id: params.staffId ?? null,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
  }

  async setOperationEnabled(params: {
    retailerId: RetailerId;
    operationId: AlterationOperationId;
    enabled: boolean;
    staffId?: StaffId;
  }): Promise<void> {
    const { error } = await this.client
      .from("retailer_alteration_operation_settings")
      .upsert({
        retailer_id: params.retailerId,
        operation_id: params.operationId,
        enabled: params.enabled,
        updated_by_staff_id: params.staffId ?? null,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
  }

  async setOperationPrice(params: {
    operationId: AlterationOperationId;
    amountMinorUnits: number;
    workshopId?: WorkshopId;
  }): Promise<void> {
    const { error } = await this.client.rpc("set_alteration_operation_price", {
      p_operation_id: params.operationId,
      p_amount_minor_units: params.amountMinorUnits,
      ...(params.workshopId ? { p_workshop_id: params.workshopId } : {}),
    });
    if (error) throw error;
  }
}
