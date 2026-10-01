"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type LocationStatus = "unknown" | "granted" | "denied";

export type HomeLocation = {
  readonly label: string;
  /** The province or state, printed after the city: "Breda, NB". */
  readonly region: string;
  readonly coords: { readonly lat: number; readonly lon: number };
  readonly timeZone: string;
  /** The work address saved on the profile; "" when none is set. */
  readonly workAddress: string;
  /** The home address saved on the profile; "" when none is set. */
  readonly homeAddress: string;
  /** True for a visitor without an account. */
  readonly guest: boolean;
  /** Whether the browser has granted location access. */
  readonly locationStatus: LocationStatus;
  /** Asks the browser for location access. */
  readonly requestLocation: () => void;
};

type BaseLocation = Pick<
  HomeLocation,
  "label" | "region" | "coords" | "timeZone"
>;

/**
 * The default home base. The overview keeps New York time until the viewer
 * allows location access; from then on it keeps the time where they are.
 */
export const HOME_LOCATION = {
  label: "New York",
  region: "NY",
  coords: { lat: 40.7736, lon: -73.9566 },
  timeZone: "America/New_York",
  workAddress: "745 Fifth Avenue, New York, NY 10151",
} as const;

/** The drive shown to a visitor without an account. */
export const GUEST_COMMUTE_MINUTES = 19;

const HomeLocationContext = createContext<HomeLocation>({
  ...HOME_LOCATION,
  workAddress: "",
  homeAddress: "",
  guest: true,
  locationStatus: "unknown",
  requestLocation: () => undefined,
});

function deviceTimeZone(): string {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || HOME_LOCATION.timeZone
    );
  } catch {
    return HOME_LOCATION.timeZone;
  }
}

/** Takes plain values rather than the location: server layouts render this,
 * and a constant imported from a client module reaches them only as a
 * reference. */
export function HomeLocationProvider({
  guest,
  workAddress = "",
  homeAddress = "",
  children,
}: {
  guest: boolean;
  workAddress?: string;
  homeAddress?: string;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<LocationStatus>("unknown");
  const [base, setBase] = useState<BaseLocation>(HOME_LOCATION);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStatus("granted");
        setBase({
          label: "",
          region: "",
          coords: {
            lat: Math.round(position.coords.latitude * 1000) / 1000,
            lon: Math.round(position.coords.longitude * 1000) / 1000,
          },
          timeZone: deviceTimeZone(),
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setStatus("denied");
      },
      { maximumAge: 10 * 60_000, timeout: 15_000 },
    );
  }, []);

  /* Never asks on its own: an access already granted is used, anything else
     waits for "Allow location". */
  useEffect(() => {
    if (!navigator.permissions?.query) return;
    let disposed = false;
    let permission: PermissionStatus | null = null;
    const apply = (state: PermissionState) => {
      if (disposed) return;
      if (state === "granted") {
        locate();
        return;
      }
      setStatus(state === "denied" ? "denied" : "unknown");
      setBase(HOME_LOCATION);
    };
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        permission = result;
        apply(result.state);
        result.onchange = () => apply(result.state);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      if (permission) permission.onchange = null;
    };
  }, [locate]);

  const value = useMemo<HomeLocation>(
    () => ({
      ...base,
      workAddress: guest ? HOME_LOCATION.workAddress : workAddress,
      homeAddress: guest ? "" : homeAddress,
      guest,
      locationStatus: status,
      requestLocation: locate,
    }),
    [base, guest, workAddress, homeAddress, status, locate],
  );

  return (
    <HomeLocationContext.Provider value={value}>
      {children}
    </HomeLocationContext.Provider>
  );
}

export function useHomeLocation(): HomeLocation {
  return useContext(HomeLocationContext);
}
