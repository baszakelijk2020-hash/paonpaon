"use server";

import { MicroCapsuleRepository, ProductRepository } from "@paon/database";
import { createMicroCapsuleDropInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function createDrop(formData: FormData): Promise<void> {
  const session = await requireModuleSession("retail_operations");
  const supabase = await getSupabaseServerClient();

  const slugs = String(formData.get("productSlugs") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const productRepo = new ProductRepository(supabase);
  const productIds: string[] = [];
  for (const slug of slugs) {
    const product = await productRepo.findBySlug(session.retailerId, slug);
    if (!product) throw new Error(`No product found with slug "${slug}".`);
    productIds.push(product.id);
  }

  const values = createMicroCapsuleDropInputSchema.parse({
    title: formData.get("title"),
    theme: (formData.get("theme") as string | null) || undefined,
    weekStart: formData.get("weekStart"),
    productIds,
  });

  await new MicroCapsuleRepository(supabase).createDrop(
    session.retailerId,
    values,
  );
  revalidatePath("/capsule-drops");
}

export async function setPublished(
  dropId: string,
  published: boolean,
): Promise<void> {
  await requireModuleSession("retail_operations");
  await new MicroCapsuleRepository(
    await getSupabaseServerClient(),
  ).setPublished(dropId, published);
  revalidatePath("/capsule-drops");
}
