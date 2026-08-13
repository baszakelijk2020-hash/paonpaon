import { requireModuleSession } from "@/lib/module-session";

export default async function FabricPairingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireModuleSession("garment_service_operations", "read");
  return children;
}
