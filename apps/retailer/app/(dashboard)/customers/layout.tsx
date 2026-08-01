import { requireModuleSession } from "@/lib/module-session";

export default async function CustomersModuleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireModuleSession("relationship_intelligence", "read");
  return children;
}
