import { requireModuleSession } from "@/lib/module-session";

export default async function StaffLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireModuleSession("retail_operations", "read");
  return children;
}
