import { ScrollMemory } from "./(dashboard)/scroll-memory";
import { ShopCategorySidebar } from "./(dashboard)/shop-category-sidebar";

/**
 * The single shell shared by the customer environment ((dashboard)) and the
 * storefront (r/[slug]).
 *
 * The sidebar used to be rendered twice — once in (dashboard)/layout.tsx and
 * once inside the storefront page itself — so moving between the two
 * environments unmounted one instance and mounted a different one, re-running
 * its Supabase queries and visibly reloading it. Both route subtrees now live
 * under this one route group, whose layout Next.js preserves across every
 * client-side navigation between them: one mount, one data fetch, no reload.
 *
 * Route groups do not appear in the URL, so /dashboard and /r/[slug] are
 * unchanged.
 *
 * Positioning: the wrapper is fixed rather than a grid column because the two
 * environments reserve the 250px differently and both already do so correctly
 * — (dashboard)/layout.tsx keeps its own 250px grid track, and the storefront
 * template keeps its own <aside> in flow (hidden by paon-template-parity.css).
 * Laying the shell sidebar over that reserved column leaves both layouts as
 * they were.
 */
export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /*
   * `children` is rendered FIRST, and the sidebar after it, on purpose.
   *
   * The storefront template ends with `var aside = document.querySelector('aside')`
   * (paon-template.html:14585) and rebuilds that element's innerHTML. It means
   * its own <aside>, but querySelector returns the first one in the document —
   * and a layout renders before its children, so the shared sidebar was that
   * first match and the template overwrote it, destroying the React subtree
   * (the brand shimmer along with it). Emitting the route's content first puts
   * the template's own <aside> back in front, so the script finds what it
   * expects. The wrapper is position:fixed, so document order has no effect on
   * where the sidebar actually appears.
   */
  return (
    <>
      <ScrollMemory />
      {/*
        The storefront is not unmounted when the visitor leaves it — it stays
        laid out and painted, pinned behind this. So the customer environment
        has to be opaque and above it, or the storefront would show through.
        See park() in r/[slug]/template-mount.tsx for why it is covered rather
        than hidden.
      */}
      <div className="paon-shell-content">{children}</div>
      <div
        data-paon-shell-sidebar
        className="fixed left-0 top-0 z-[120] hidden h-screen w-[250px] lg:block"
      >
        <ShopCategorySidebar />
      </div>
    </>
  );
}
