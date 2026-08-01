import { requireModuleSession } from "@/lib/module-session";

export default async function EventsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireModuleSession("commerce_growth", "read");
  return children;
}
