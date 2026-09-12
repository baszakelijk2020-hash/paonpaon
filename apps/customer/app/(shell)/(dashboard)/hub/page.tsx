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
  { id: "dashboard", href: "/dashboard" },
  { id: "wardrobe", href: "/wardrobe" },
  { id: "appointments", href: "/appointments" },
  { id: "orders", href: "/orders" },
  { id: "digital-fitting-room", href: "/digital-fitting-room" },
  { id: "loyalty", href: "/loyalty" },
  { id: "account", href: "/account" },
  { id: "private-offers", href: "/private-offers" },
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
    href: meta.href,
    panel: <Suspense fallback={<PanelFallback />}>{panels[meta.id]}</Suspense>,
  }));

  // The layout's own AccountTopTabs stays visible and unchanged; HubTabs just
  // intercepts its links so they switch a panel instead of navigating.
  return <HubTabs tabs={tabs} initialTabId={initialTabId} />;
}
