import { MicroCapsuleRepository, ProductRepository } from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";

import { createDrop, setPublished } from "./actions";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function CapsuleDropsPage() {
  const session = await requireModuleSession("retail_operations", "read");
  const supabase = await getSupabaseServerClient();
  const dropRepo = new MicroCapsuleRepository(supabase);
  const productRepo = new ProductRepository(supabase);

  const [drops, products] = await Promise.all([
    dropRepo.findByRetailer(session.retailerId),
    productRepo.findByRetailer(session.retailerId),
  ]);
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );
  const productsByDrop = new Map(
    await Promise.all(
      drops.map(
        async (drop) =>
          [drop.id, await dropRepo.findProductsForDrop(drop.id)] as const,
      ),
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Capsule drops
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          A small, ordered set of products published as this week&rsquo;s
          capsule on the customer app.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Drops
        </h2>
        {drops.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No capsule drops yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {drops.map((drop) => {
              const dropProducts = productsByDrop.get(drop.id) ?? [];
              return (
                <li key={drop.id} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-stone-900)]">
                        {drop.title}
                      </p>
                      <p className="text-xs text-[var(--color-stone-500)]">
                        Week of {drop.weekStart}
                        {drop.theme ? ` · ${drop.theme}` : ""} ·{" "}
                        {dropProducts.length} piece
                        {dropProducts.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={drop.published ? "success" : "neutral"}>
                        {drop.published ? "Published" : "Draft"}
                      </Badge>
                      <form
                        action={setPublished.bind(
                          null,
                          drop.id,
                          !drop.published,
                        )}
                      >
                        <Button type="submit" variant="secondary" size="sm">
                          {drop.published ? "Unpublish" : "Publish"}
                        </Button>
                      </form>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {dropProducts
                      .map(
                        (item) =>
                          productsById.get(item.productId)?.name ??
                          item.productId,
                      )
                      .join(" → ")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          New drop
        </h2>
        <form action={createDrop} className="flex flex-col gap-3">
          <FormField label="Title" htmlFor="title">
            <Input id="title" name="title" required minLength={1} />
          </FormField>
          <FormField label="Theme (optional)" htmlFor="theme">
            <Input id="theme" name="theme" />
          </FormField>
          <FormField label="Week starting" htmlFor="weekStart">
            <Input id="weekStart" name="weekStart" type="date" required />
          </FormField>
          <FormField
            label="Product slugs, one per line, in display order"
            htmlFor="productSlugs"
            hint={
              products.length > 0
                ? `Available: ${products
                    .slice(0, 8)
                    .map((product) => product.slug)
                    .join(", ")}${products.length > 8 ? "…" : ""}`
                : "No products yet."
            }
          >
            <textarea
              id="productSlugs"
              name="productSlugs"
              required
              rows={4}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-stone-300)] p-2 font-mono text-xs"
            />
          </FormField>
          <Button type="submit" className="self-start">
            Create drop
          </Button>
        </form>
      </Card>
    </div>
  );
}
