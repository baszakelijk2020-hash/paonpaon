"use client";

import { useEffect } from "react";

import {
  trackStorefrontEvent,
  type StorefrontTrackedEvent,
} from "./track-actions";

/** Fires once on mount — a page render alone (including SSR/prefetch)
 * must not count as a view, only an actual client-side visit. */
export function TrackView({
  retailerId,
  name,
  properties,
}: {
  retailerId: string;
  name: StorefrontTrackedEvent;
  properties: Record<string, string | number | boolean>;
}) {
  const propertiesKey = JSON.stringify(properties);

  useEffect(() => {
    void trackStorefrontEvent(retailerId, name, JSON.parse(propertiesKey));
  }, [retailerId, name, propertiesKey]);

  return null;
}
