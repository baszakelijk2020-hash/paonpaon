import { Suspense } from "react";

import AccountPage from "../account/page";
import AppointmentsPage from "../appointments/page";
import DashboardPage from "../dashboard/page";
import DigitalFittingRoomPage from "../digital-fitting-room/page";
import LoyaltyPage from "../loyalty/page";
import OrdersPage from "../orders/page";
import PrivateOffersPage from "../private-offers/page";
import WardrobePage from "../wardrobe/page";

import { HubTabs, type HubTab } from "./hub-tabs";

/**
 * One route that renders all eight account tabs together.
 *
 * Each tab was its own route, so switching cost a server render plus its own
 * database work every time. Mounting them together means the switch is a class
 * toggle — the same thing the storefront's clothing categories do, which is the
 * speed this is held to.
 *
 * Every panel is wrapped in its own Suspense boundary so the shell and whichever
 * tab resolves first paint immediately; the slower panels stream in behind
 * without holding up the page. The original eight routes are untouched and still
 * serve deep links.
 */

const TAB_META = [
  { id: "dashboard", label: "Overview", href: "/dashboard" },
  { id: "wardrobe", label: "Wardrobe", href: "/wardrobe" },
  { id: "appointments", label: "My Appointments", href: "/appointments" },
  { id: "orders", label: "Orders", href: "/orders" },
  {
    id: "digital-fitting-room",
    label: "Digital Fitting Room",
    href: "/digital-fitting-room",
  },
  { id: "loyalty", label: "Rewards & Referrals", href: "/loyalty" },
  { id: "account", label: "My Profile", href: "/account" },
  { id: "private-offers", label: "Private Offers", href: "/private-offers" },
] as const;

function PanelFallback() {
  return (
    <div className="py-10 text-sm text-[var(--color-stone-500)]">Loading…</div>
  );
}

export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = typeof params["tab"] === "string" ? params["tab"] : null;
  const initialTabId =
    TAB_META.find((t) => t.id === requested)?.id ?? TAB_META[0].id;

  // The two tabs that read the query string take it as a promise, matching the
  // Next 15 page contract; re-wrapping the already-awaited params satisfies it.
  const forwarded = Promise.resolve(params);

  const panels: Record<string, React.ReactNode> = {
    dashboard: <DashboardPage />,
    wardrobe: <WardrobePage />,
    appointments: (
      <AppointmentsPage
        searchParams={
          forwarded as unknown as Parameters<
            typeof AppointmentsPage
          >[0]["searchParams"]
        }
      />
    ),
    orders: <OrdersPage />,
    "digital-fitting-room": (
      <DigitalFittingRoomPage
        searchParams={
          forwarded as unknown as Parameters<
            typeof DigitalFittingRoomPage
          >[0]["searchParams"]
        }
      />
    ),
    loyalty: <LoyaltyPage />,
    account: <AccountPage />,
    "private-offers": <PrivateOffersPage />,
  };

  const tabs: HubTab[] = TAB_META.map((meta) => ({
    id: meta.id,
    label: meta.label,
    href: meta.href,
    panel: <Suspense fallback={<PanelFallback />}>{panels[meta.id]}</Suspense>,
  }));

  return (
    <>
      {/* The (dashboard) layout renders its own AccountTopTabs, which navigate.
          On this route HubTabs replaces them, so the navigating set is hidden
          rather than removed - the eight standalone routes still use it. */}
      <style>{`[data-customer-top-menu] { display: none !important; }`}</style>
      <HubTabs tabs={tabs} initialTabId={initialTabId} />
    </>
  );
}
