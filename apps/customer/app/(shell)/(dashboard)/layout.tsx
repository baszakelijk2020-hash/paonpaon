import "./customer-environment.css";

import type { Address } from "@paon/domain";

import { CustomerNavigationLifecycle } from "./customer-navigation-lifecycle";
import { EnvironmentMotion } from "./environment-motion";
import { HomeLocationProvider } from "./morning-routine/home-location";
import { SmoothScrollBinder } from "./smooth-scroll-binder";

import { getCustomersForUser } from "@/lib/customer-context";
import { getViewerSession, type ViewerSession } from "@/lib/session";

/** One line a geocoder can read: "Street 1, 1234 AB City". */
function addressLine(address: Address | undefined): string {
  if (!address) return "";
  return [
    [address.line1, address.line2].filter(Boolean).join(" "),
    [address.postalCode, address.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

/** The first home and work address saved across the viewer's profiles. */
async function savedAddresses(
  userId: ViewerSession["userId"],
): Promise<{ home: string; work: string }> {
  try {
    const addresses = (await getCustomersForUser(userId)).flatMap(
      (customer) => customer.shippingAddresses,
    );
    return {
      home: addressLine(addresses.find((a) => a.label === "home")),
      work: addressLine(addresses.find((a) => a.label === "work")),
    };
  } catch {
    return { home: "", work: "" };
  }
}

/**
 * Guests get the whole environment, not a login wall: pages read through
 * `getViewerSession`, whose guest stand-in owns no rows, and the overview
 * greets the demo persona in New York. Anything that writes still signs in.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getViewerSession();
  const addresses = session.isGuest
    ? { home: "", work: "" }
    : await savedAddresses(session.userId);

  return (
    <div
      data-customer-shell
      data-guest-viewer={session.isGuest ? "" : undefined}
      className="paon-env customer-page min-h-screen"
    >
      <div className="relative z-10 min-w-0">
        <CustomerNavigationLifecycle />
        <EnvironmentMotion />
        <SmoothScrollBinder />
        <HomeLocationProvider
          guest={session.isGuest}
          homeAddress={addresses.home}
          workAddress={addresses.work}
        >
          <main className="pe-workspace">{children}</main>
        </HomeLocationProvider>
      </div>
    </div>
  );
}
