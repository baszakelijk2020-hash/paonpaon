import { notFound } from "next/navigation";

/**
 * FT-03 (QR try-on / fabric-batch concept order) was deleted from active
 * PAON scope by explicit founder decision (FOUNDER_TOOL_BLUEPRINTS.md
 * "Founder decision register — 2026-08-12": "FT-03 ... | Delete."). This
 * route must stay unreachable unconditionally — not merely when the
 * unrelated wardrobe_styling module happens to be off, since that module
 * hosts many other real active features and would otherwise resurface a
 * deleted tool whenever it is on. Underlying domain/database code is
 * preserved as history; only route reachability is blocked here.
 */
export default async function ConceptsLayout() {
  notFound();
}
