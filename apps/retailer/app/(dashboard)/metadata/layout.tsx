import { requireModuleSession } from "@/lib/module-session";

export default async function MetadataLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireModuleSession("wardrobe_styling", "read");
  return children;
}
