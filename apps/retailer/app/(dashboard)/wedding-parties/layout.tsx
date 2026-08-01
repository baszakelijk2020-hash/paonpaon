import { requireModuleSession } from "@/lib/module-session";

export default async function WeddingPartyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireModuleSession("enterprise_verticals", "read");
  return children;
}
