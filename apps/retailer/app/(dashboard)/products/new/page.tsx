import { requireRetailerRole } from "@paon/auth";
import { redirect } from "next/navigation";

import { ProductForm } from "./product-form";

import { requireSession } from "@/lib/session";

export default async function NewProductPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    redirect("/products");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          New product
        </h1>
      </div>
      <ProductForm />
    </div>
  );
}
