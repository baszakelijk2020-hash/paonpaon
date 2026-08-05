import { requireRetailerRole } from "@paon/auth";
import {
  ConceptScanRepository,
  ProductRepository,
  ProductVariantRepository,
} from "@paon/database";
import {
  CONCEPT_SCAN_CODE_STATUS_LABELS,
  CONCEPT_SCAN_KIND_LABELS,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { redirect } from "next/navigation";

import {
  issueConceptScanCode,
  recallConceptScanCode,
  rotateConceptScanCode,
} from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ConceptsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServerClient();
  const conceptRepo = new ConceptScanRepository(supabase);
  const products = (
    await new ProductRepository(supabase).findByRetailer(session.retailerId)
  ).filter((product) => product.status === "active");
  const variantsByProduct = await Promise.all(
    products.map((product) =>
      new ProductVariantRepository(supabase).findByProduct(product.id),
    ),
  );
  const variantLabelById = new Map<string, string>();
  products.forEach((product, index) => {
    (variantsByProduct[index] ?? []).forEach((variant) => {
      const suffix = [variant.size, variant.color].filter(Boolean).join(" · ");
      variantLabelById.set(
        variant.id,
        `${product.name}${suffix ? ` — ${suffix}` : ""}`,
      );
    });
  });

  const codes = await conceptRepo.findCodesByRetailer(session.retailerId);
  const submitted = await conceptRepo.findSubmittedSelectionsByRetailer(
    session.retailerId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Concept scan codes</h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Issue a code for a Try-On or fabric swatch — a customer scans or types
          it to add the piece to their own concept order, then sends the
          accumulated selection to their advisor.
        </p>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-medium">Issue a scan code</h2>
        <form
          action={issueConceptScanCode}
          className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="flex flex-col gap-1 text-sm">
            Piece
            <select
              name="productVariantId"
              required
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-2"
            >
              {[...variantLabelById.entries()].map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Kind
            <select
              name="kind"
              required
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-2"
            >
              <option value="try_on">Try-On</option>
              <option value="fabric_swatch">Fabric swatch</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Expires (optional)
            <input
              name="expiresAt"
              type="date"
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-2"
            />
          </label>
          {variantLabelById.size === 0 ? (
            <p className="text-sm text-[var(--color-stone-500)]">
              Add an active product to the catalogue first.
            </p>
          ) : (
            <Button type="submit">Issue code</Button>
          )}
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium">Issued codes</h2>
        {codes.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No scan codes yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {codes.map((code) => (
              <li
                key={code.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  <code className="font-mono">{code.code}</code>
                  {" — "}
                  {variantLabelById.get(code.productVariantId) ??
                    "Unknown piece"}
                  {" · "}
                  {CONCEPT_SCAN_KIND_LABELS[code.kind]}
                  {" · "}
                  {CONCEPT_SCAN_CODE_STATUS_LABELS[code.status]}
                </span>
                {code.status === "active" ? (
                  <span className="flex gap-2">
                    <form action={rotateConceptScanCode}>
                      <input type="hidden" name="codeId" value={code.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Rotate
                      </Button>
                    </form>
                    <form action={recallConceptScanCode}>
                      <input type="hidden" name="codeId" value={code.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Recall
                      </Button>
                    </form>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium">
          Concept orders sent by customers
        </h2>
        {submitted.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No concept orders sent yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {submitted.map((selection) => (
              <li
                key={selection.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 text-sm"
              >
                <p className="font-medium">
                  {selection.customerName}
                  {" — "}
                  {new Date(selection.submittedAt).toLocaleDateString()}
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {selection.items.map((item) => (
                    <li
                      key={item.scanCodeId}
                      className="text-[var(--color-stone-700)]"
                    >
                      {CONCEPT_SCAN_KIND_LABELS[item.kind]}
                      {" — "}
                      {item.productName}
                      {item.variantLabel ? ` · ${item.variantLabel}` : ""}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
