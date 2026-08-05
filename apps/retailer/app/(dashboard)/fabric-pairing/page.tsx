import {
  MetadataRepository,
  ProductRepository,
  SupplierIntelligenceRepository,
} from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import Link from "next/link";

import { upsertButtonRule, upsertLiningRule } from "./actions";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const COMPLETE_THE_LOOK_EDGE_KINDS = new Set(["suggests", "compatible_with"]);

export default async function FabricPairingPage({
  searchParams,
}: {
  searchParams: Promise<{ fabric?: string }>;
}) {
  const { fabric: fabricConceptId } = await searchParams;
  const session = await requireModuleSession("retail_operations", "read");
  const supabase = await getSupabaseServerClient();
  const canManageRules = retailerRoleAtLeast(session.retailerRole, "manager");

  const metadataRepo = new MetadataRepository(supabase);
  const supplierRepo = new SupplierIntelligenceRepository(supabase);

  const [fabricConcepts, buttonRules, liningRules] = await Promise.all([
    metadataRepo.findVisibleConcepts(session.retailerId, "fabric_collection"),
    supplierRepo.findFabricButtonRules({ retailerId: session.retailerId }),
    supplierRepo.findFabricLiningRules({ retailerId: session.retailerId }),
  ]);

  const selectedConcept = fabricConceptId
    ? fabricConcepts.find((concept) => concept.id === fabricConceptId)
    : undefined;

  const buttonRule = selectedConcept
    ? buttonRules.find((row) => row.fabric_key === selectedConcept.slug)
    : undefined;
  const liningRule = selectedConcept
    ? liningRules.find((row) => row.fabric_key === selectedConcept.slug)
    : undefined;

  let completeTheLookProducts: {
    readonly id: string;
    readonly name: string;
  }[] = [];
  if (selectedConcept) {
    const edges = await metadataRepo.findVisibleEdges(
      session.retailerId,
      selectedConcept.id,
    );
    const targetConceptIds = edges
      .filter((edge) => COMPLETE_THE_LOOK_EDGE_KINDS.has(edge.kind))
      .map((edge) => edge.targetConceptId);
    const productIds = await metadataRepo.findProductIdsByConcepts(
      session.retailerId,
      targetConceptIds,
    );
    const productRepo = new ProductRepository(supabase);
    completeTheLookProducts = (
      await Promise.all(productIds.map((id) => productRepo.findById(id)))
    ).filter((product): product is NonNullable<typeof product> => !!product);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Fabric pairing
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Pick a fabric and see exactly what every advisor should offer next —
          the same top-matching buttons, lining options and complete-the-look
          items regardless of who is asking. A missing rule means undecided,
          never permissive.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
          Fabric
        </p>
        {fabricConcepts.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No fabric concepts exist yet for this retailer.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {fabricConcepts.map((concept) => (
            <Link
              key={concept.id}
              href={`/fabric-pairing?fabric=${concept.id}`}
              className={`rounded-[var(--radius-md)] border px-3 py-1.5 text-sm ${
                selectedConcept?.id === concept.id
                  ? "border-[var(--color-stone-900)] bg-[var(--color-stone-900)] text-white"
                  : "border-[var(--color-stone-200)] hover:bg-[var(--color-stone-50)]"
              }`}
            >
              {concept.canonicalName}
            </Link>
          ))}
        </div>
      </Card>

      {selectedConcept ? (
        <>
          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
              Top-matching buttons
            </h2>
            {buttonRule ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {buttonRule.allowed_button_keys.map((key) => (
                    <Badge key={key} tone="success">
                      {key}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {buttonRule.note}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-stone-500)]">
                No rule yet — undecided, not open to any button.
              </p>
            )}
            {canManageRules ? (
              <form
                action={upsertButtonRule}
                className="flex flex-col gap-3 pt-2"
              >
                <input
                  type="hidden"
                  name="fabricKey"
                  value={selectedConcept.slug}
                />
                <FormField
                  label="Allowed button keys (comma-separated)"
                  htmlFor="allowedButtonKeys"
                >
                  <Input
                    id="allowedButtonKeys"
                    name="allowedButtonKeys"
                    defaultValue={buttonRule?.allowed_button_keys.join(", ")}
                    required
                  />
                </FormField>
                <FormField label="Note" htmlFor="buttonNote">
                  <Input
                    id="buttonNote"
                    name="buttonNote"
                    defaultValue={buttonRule?.note}
                    required
                  />
                </FormField>
                <Button
                  type="submit"
                  variant="secondary"
                  className="self-start"
                >
                  {buttonRule ? "Update button rule" : "Save button rule"}
                </Button>
              </form>
            ) : null}
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
              Lining options
            </h2>
            {liningRule ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {liningRule.standard_lining_keys.map((key) => (
                    <Badge key={key} tone="neutral">
                      {key} · standard
                    </Badge>
                  ))}
                  {liningRule.upsell_lining_keys.map((key) => (
                    <Badge key={key} tone="warning">
                      {key} · upsell
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {liningRule.note}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-stone-500)]">
                No rule yet — undecided, not open to any lining.
              </p>
            )}
            {canManageRules ? (
              <form
                action={upsertLiningRule}
                className="flex flex-col gap-3 pt-2"
              >
                <input
                  type="hidden"
                  name="fabricKey"
                  value={selectedConcept.slug}
                />
                <FormField
                  label="Standard lining keys (comma-separated)"
                  htmlFor="standardLiningKeys"
                >
                  <Input
                    id="standardLiningKeys"
                    name="standardLiningKeys"
                    defaultValue={liningRule?.standard_lining_keys.join(", ")}
                    required
                  />
                </FormField>
                <FormField
                  label="Upsell lining keys (comma-separated, optional)"
                  htmlFor="upsellLiningKeys"
                >
                  <Input
                    id="upsellLiningKeys"
                    name="upsellLiningKeys"
                    defaultValue={liningRule?.upsell_lining_keys.join(", ")}
                  />
                </FormField>
                <FormField label="Note" htmlFor="liningNote">
                  <Input
                    id="liningNote"
                    name="liningNote"
                    defaultValue={liningRule?.note}
                    required
                  />
                </FormField>
                <Button
                  type="submit"
                  variant="secondary"
                  className="self-start"
                >
                  {liningRule ? "Update lining rule" : "Save lining rule"}
                </Button>
              </form>
            ) : null}
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
              Complete the look
            </h2>
            {completeTheLookProducts.length === 0 ? (
              <p className="text-sm text-[var(--color-stone-500)]">
                No linked items yet for this fabric — add a
                &ldquo;suggests&rdquo; or &ldquo;compatible with&rdquo; concept
                edge to surface real catalogue pieces here.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {completeTheLookProducts.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/products/${product.id}`}
                      className="block rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm hover:bg-[var(--color-stone-50)]"
                    >
                      {product.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
