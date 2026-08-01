import { requireModuleSession } from "@/lib/module-session";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireModuleSession("platform_core", "read");
  return children;
}
