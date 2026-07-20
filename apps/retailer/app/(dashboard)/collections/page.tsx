import { requireRetailerRole } from "@paon/auth";
import { CollectionRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { redirect } from "next/navigation";

import { CollectionForm } from "./collection-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function CollectionsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    redirect("/products");
  }

  const supabase = await getSupabaseServerClient();
  const collections = await new CollectionRepository(supabase).findByRetailer(
    session.retailerId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
          Collections
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          {collections.length} collection{collections.length === 1 ? "" : "s"}
        </p>
      </div>

      <Card>
        <CollectionForm />
      </Card>

      {collections.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">No collections yet.</p>
        </div>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {collections.map((collection) => (
            <div key={collection.id} className="px-6 py-4">
              <p className="font-medium text-[var(--color-stone-900)]">
                {collection.name}
              </p>
              <p className="text-sm text-[var(--color-stone-500)]">
                {collection.slug}
                {collection.season ? ` · ${collection.season}` : ""}
              </p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
