import type { SVGProps } from "react";

/**
 * Line icons for the overview's stat tiles. All drawn on a 24-grid in
 * currentColor at 1.75 stroke so they sit with the sidebar marks and never
 * pick up the platform's emoji set.
 */

function Icon({
  children,
  ...props
}: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const SunIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5m14 0h2.5M5.3 5.3l1.8 1.8m9.8 9.8 1.8 1.8M5.3 18.7l1.8-1.8m9.8-9.8 1.8-1.8" />
  </Icon>
);

export const MoonIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </Icon>
);

export const CloudIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.5 4.25 4.25 0 0 0 7 18Z" />
  </Icon>
);

export const PartlyCloudyIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8.5 6.5a3.5 3.5 0 0 1 6.6 1M8.5 2.5v1.5M3 8h1.5M4.6 4.6l1 1M13.4 4.6l-1 1" />
    <path d="M9 20h8.5a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 8.4 12.8 3.6 3.6 0 0 0 9 20Z" />
  </Icon>
);

export const RainIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 6.5 4.25 4.25 0 0 0 7 15Z" />
    <path d="M8 18.5 7 21m5-2.5-1 2.5m5-2.5-1 2.5" />
  </Icon>
);

export const SnowIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M7 14h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 5.5 4.25 4.25 0 0 0 7 14Z" />
    <path d="M8 18h.01M12 20h.01M16 18h.01M10 21h.01M14 21h.01" />
  </Icon>
);

export const FogIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M7 12h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 3.5 4.25 4.25 0 0 0 7 12Z" />
    <path d="M5 16h14M7 20h10" />
  </Icon>
);

export const ThunderIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M7 14h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 5.5 4.25 4.25 0 0 0 7 14Z" />
    <path d="m12.5 13-2 4h3l-2 4" />
  </Icon>
);

export const SunriseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 18h18M6 21h12" />
    <path d="M7 15a5 5 0 0 1 10 0" />
    <path d="M12 3v5m-3-2 3-3 3 3" />
    <path d="M4.5 12l1.3 1.3M19.5 12l-1.3 1.3M2 15.5h2m18 0h-2" />
  </Icon>
);

export const SunsetIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 18h18M6 21h12" />
    <path d="M7 15a5 5 0 0 1 10 0" />
    <path d="M12 3v5m-3-2 3 3 3-3" />
    <path d="M4.5 12l1.3 1.3M19.5 12l-1.3 1.3M2 15.5h2m18 0h-2" />
  </Icon>
);

export const CarIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5 16.5V11l2-5h10l2 5v5.5" />
    <path d="M3 11h18M5 16.5h14" />
    <circle cx="7.5" cy="16.5" r="1.75" />
    <circle cx="16.5" cy="16.5" r="1.75" />
  </Icon>
);

export const WorkIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2.5" />
    <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12h18" />
  </Icon>
);

export const AirIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5" />
    <path d="M3 13h14a3 3 0 1 1-3 3" />
    <path d="M3 18h7" />
  </Icon>
);

/** A compass needle; rotated by the caller to point where the wind goes. */
export const WindIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 3v18M12 3l-4 5M12 3l4 5" />
  </Icon>
);

/** Open-Meteo WMO code → icon. */
export function WeatherIcon({
  code,
  isDay = true,
  ...props
}: SVGProps<SVGSVGElement> & { code: number; isDay?: boolean }) {
  if (code >= 95) return <ThunderIcon {...props} />;
  if (code >= 71 && code <= 77) return <SnowIcon {...props} />;
  if (code >= 51 && code <= 82) return <RainIcon {...props} />;
  if (code >= 45 && code <= 48) return <FogIcon {...props} />;
  if (code === 3) return <CloudIcon {...props} />;
  if (code >= 1 && code <= 2) return <PartlyCloudyIcon {...props} />;
  return isDay ? <SunIcon {...props} /> : <MoonIcon {...props} />;
}
