"use client";

import { useEffect, useState } from "react";

/** Critical 10 mitigation: the retailer app has no offline queue or
 * background sync — this only makes the loss of connectivity visible
 * immediately, instead of a silent failed Server Action a floor
 * advisor might not notice until they walk away from a client. */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!window.navigator.onLine);
    function handleOnline() {
      setIsOffline(false);
    }
    function handleOffline() {
      setIsOffline(true);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 -mx-4 mb-6 bg-[var(--color-danger-500)] px-4 py-2 text-center text-sm text-white sm:-mx-7 lg:-mx-10 xl:-mx-14"
    >
      You&rsquo;re offline. Changes here won&rsquo;t save until the connection
      returns.
    </div>
  );
}
