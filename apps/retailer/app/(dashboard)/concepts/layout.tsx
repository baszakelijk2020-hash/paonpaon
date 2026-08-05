import { requireModuleSession } from "@/lib/module-session";

export default async function ConceptsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireModuleSession("wardrobe_styling", "read");
  return children;
}
