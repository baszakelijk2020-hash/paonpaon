import {
  AlterationCatalogueRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { retailerRoleHasAlterationsPermission } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";
import { redirect } from "next/navigation";

import {
  updateCategorySetting,
  updateOperationSetting,
  updateWorkshopPrice,
} from "./actions";
import { CatalogueActionForm } from "./catalogue-action-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AlterationCataloguePage() {
  const session = await requireSession();
  const canConfigure = retailerRoleHasAlterationsPermission(
    session.retailerRole,
    "configure",
  );
  const isWorkshopManager = retailerRoleHasAlterationsPermission(
    session.retailerRole,
    "manage_assigned_workshop",
  );
  if (!canConfigure && !isWorkshopManager) {
    redirect("/alterations");
  }
  const supabase = await getSupabaseServerClient();
  const staff = isWorkshopManager
    ? await new RetailerStaffRepository(supabase).findByUserId(session.userId)
    : null;
  if (isWorkshopManager && !staff?.workshopId) redirect("/alterations");
  const catalogue = await new AlterationCatalogueRepository(
    supabase,
  ).findForRetailer(session.retailerId, staff?.workshopId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
          Alteration catalogue & prices
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          {isWorkshopManager
            ? "Maintain your workshop's effective cost price list in minor-unit-safe Money values."
            : "Enable the premium-menswear operations your house offers and maintain the effective retailer price list in minor-unit-safe Money values."}
        </p>
      </div>
      {catalogue.categories
        .filter((category) => canConfigure || category.enabled)
        .map((category) => (
          <Card key={category.id} className="p-0">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-stone-200)] px-5 py-4">
              <div>
                <h2 className="font-medium">{category.name}</h2>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {category.description}
                </p>
              </div>
              {canConfigure ? (
                <CatalogueActionForm
                  action={updateCategorySetting}
                  submitLabel={
                    category.enabled ? "Hide category" : "Enable category"
                  }
                >
                  <input type="hidden" name="categoryId" value={category.id} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={category.enabled ? "false" : "true"}
                  />
                </CatalogueActionForm>
              ) : null}
            </div>
            <div className="divide-y divide-[var(--color-stone-100)]">
              {catalogue.operations
                .filter(
                  (operation) =>
                    operation.categoryId === category.id &&
                    (canConfigure || operation.enabled),
                )
                .map((operation) => (
                  <CatalogueActionForm
                    key={operation.id}
                    action={
                      isWorkshopManager
                        ? updateWorkshopPrice
                        : updateOperationSetting
                    }
                    className="grid grid-cols-1 items-center gap-3 px-5 py-4 sm:grid-cols-[1fr_8rem_auto]"
                    submitLabel="Save"
                  >
                    <input
                      type="hidden"
                      name="operationId"
                      value={operation.id}
                    />
                    {canConfigure ? (
                      <label className="flex items-center gap-2 text-sm sm:col-span-3">
                        <input
                          type="checkbox"
                          name="enabled"
                          defaultChecked={operation.enabled}
                        />
                        Enabled for intake
                      </label>
                    ) : null}
                    <div>
                      <p className="text-sm font-medium">{operation.name}</p>
                      <p className="text-xs text-[var(--color-stone-500)]">
                        {operation.description}
                      </p>
                    </div>
                    <Input
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      aria-label={`${operation.name} price`}
                      defaultValue={
                        operation.effectivePrice
                          ? operation.effectivePrice.amountMinorUnits / 100
                          : undefined
                      }
                      placeholder="Price"
                    />
                  </CatalogueActionForm>
                ))}
            </div>
          </Card>
        ))}
    </div>
  );
}
