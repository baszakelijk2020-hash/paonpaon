import { requireModuleSession } from "@/lib/module-session";

export default async function ImportsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireModuleSession("retail_operations", "read");
  return children;
}
