import { requireModuleSession } from "@/lib/module-session";

export default async function CollectionsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireModuleSession("retail_operations", "read");
  return children;
}
