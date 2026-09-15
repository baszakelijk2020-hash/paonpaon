import type { SVGProps } from "react";

/**
 * Icons for the overview's stat tiles, in currentColor so they sit with the
 * sidebar marks and never pick up the platform's emoji set.
 *
 * Two families: the house's own line marks, drawn on a 24-grid at 1.75
 * stroke, and the sky marks, which are solid Bootstrap Icons on a 16-grid.
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

/**
 * The sky marks are Bootstrap Icons (MIT, © 2019–2024 The Bootstrap
 * Authors), used as-is rather than drawn here: hand-cut weather glyphs at
 * 17px never read, and a sun behind a cloud in particular needs a proper
 * knockout that a two-shape sketch cannot give. Path data is inlined rather
 * than fetched so nothing is loaded at runtime.
 *
 * They are solid fills on a 16-grid, so they get their own wrapper — the
 * Icon above is a 24-grid stroke wrapper and would paint an outline over
 * them.
 */
function SkyGlyph({
  children,
  ...props
}: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/* bootstrap-icons: sun-fill */
export const SunIcon = (p: SVGProps<SVGSVGElement>) => (
  <SkyGlyph {...p}>
    <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708" />
  </SkyGlyph>
);

/* bootstrap-icons: moon-stars-fill */
export const MoonIcon = (p: SVGProps<SVGSVGElement>) => (
  <SkyGlyph {...p}>
    <path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278" />
    <path d="M10.794 3.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.73 1.73 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162A1.73 1.73 0 0 0 9.31 6.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.73 1.73 0 0 0 1.097-1.097zM13.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732l-.774-.258a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z" />
  </SkyGlyph>
);

/* bootstrap-icons: cloud-fill */
export const CloudIcon = (p: SVGProps<SVGSVGElement>) => (
  <SkyGlyph {...p}>
    <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383" />
  </SkyGlyph>
);

/* bootstrap-icons: cloud-sun-fill */
export const PartlyCloudyIcon = (p: SVGProps<SVGSVGElement>) => (
  <SkyGlyph {...p}>
    <path d="M11.473 11a4.5 4.5 0 0 0-8.72-.99A3 3 0 0 0 3 16h8.5a2.5 2.5 0 0 0 0-5z" />
    <path d="M10.5 1.5a.5.5 0 0 0-1 0v1a.5.5 0 0 0 1 0zm3.743 1.964a.5.5 0 1 0-.707-.707l-.708.707a.5.5 0 0 0 .708.708zm-7.779-.707a.5.5 0 0 0-.707.707l.707.708a.5.5 0 1 0 .708-.708zm1.734 3.374a2 2 0 1 1 3.296 2.198q.3.423.516.898a3 3 0 1 0-4.84-3.225q.529.017 1.028.129m4.484 4.074c.6.215 1.125.59 1.522 1.072a.5.5 0 0 0 .039-.742l-.707-.707a.5.5 0 0 0-.854.377M14.5 6.5a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1z" />
  </SkyGlyph>
);

/* bootstrap-icons: cloud-rain-fill */
export const RainIcon = (p: SVGProps<SVGSVGElement>) => (
  <SkyGlyph {...p}>
    <path d="M4.158 12.025a.5.5 0 0 1 .316.633l-.5 1.5a.5.5 0 1 1-.948-.316l.5-1.5a.5.5 0 0 1 .632-.317m3 0a.5.5 0 0 1 .316.633l-1 3a.5.5 0 1 1-.948-.316l1-3a.5.5 0 0 1 .632-.317m3 0a.5.5 0 0 1 .316.633l-.5 1.5a.5.5 0 1 1-.948-.316l.5-1.5a.5.5 0 0 1 .632-.317m3 0a.5.5 0 0 1 .316.633l-1 3a.5.5 0 1 1-.948-.316l1-3a.5.5 0 0 1 .632-.317m.247-6.998a5.001 5.001 0 0 0-9.499-1.004A3.5 3.5 0 1 0 3.5 11H13a3 3 0 0 0 .405-5.973" />
  </SkyGlyph>
);

/* bootstrap-icons: cloud-snow-fill */
export const SnowIcon = (p: SVGProps<SVGSVGElement>) => (
  <SkyGlyph {...p}>
    <path d="M2.625 11.5a.25.25 0 0 1 .25.25v.57l.501-.287a.25.25 0 0 1 .248.434l-.495.283.495.283a.25.25 0 0 1-.248.434l-.501-.286v.569a.25.25 0 1 1-.5 0v-.57l-.501.287a.25.25 0 0 1-.248-.434l.495-.283-.495-.283a.25.25 0 0 1 .248-.434l.501.286v-.569a.25.25 0 0 1 .25-.25m2.75 2a.25.25 0 0 1 .25.25v.57l.5-.287a.25.25 0 0 1 .249.434l-.495.283.495.283a.25.25 0 0 1-.248.434l-.501-.286v.569a.25.25 0 1 1-.5 0v-.57l-.501.287a.25.25 0 0 1-.248-.434l.495-.283-.495-.283a.25.25 0 0 1 .248-.434l.501.286v-.569a.25.25 0 0 1 .25-.25m5.5 0a.25.25 0 0 1 .25.25v.57l.5-.287a.25.25 0 0 1 .249.434l-.495.283.495.283a.25.25 0 0 1-.248.434l-.501-.286v.569a.25.25 0 0 1-.5 0v-.57l-.501.287a.25.25 0 0 1-.248-.434l.495-.283-.495-.283a.25.25 0 0 1 .248-.434l.501.286v-.569a.25.25 0 0 1 .25-.25m-2.75-2a.25.25 0 0 1 .25.25v.57l.5-.287a.25.25 0 0 1 .249.434l-.495.283.495.283a.25.25 0 0 1-.248.434l-.501-.286v.569a.25.25 0 1 1-.5 0v-.57l-.501.287a.25.25 0 0 1-.248-.434l.495-.283-.495-.283a.25.25 0 0 1 .248-.434l.501.286v-.569a.25.25 0 0 1 .25-.25m5.5 0a.25.25 0 0 1 .25.25v.57l.5-.287a.25.25 0 0 1 .249.434l-.495.283.495.283a.25.25 0 0 1-.248.434l-.501-.286v.569a.25.25 0 0 1-.5 0v-.57l-.501.287a.25.25 0 1 1-.248-.434l.495-.283-.495-.283a.25.25 0 0 1 .248-.434l.501.286v-.569a.25.25 0 0 1 .25-.25m-.22-7.223a5.001 5.001 0 0 0-9.499-1.004A3.5 3.5 0 1 0 3.5 10.25H13a3 3 0 0 0 .405-5.973" />
  </SkyGlyph>
);

/* bootstrap-icons: cloud-fog2-fill */
export const FogIcon = (p: SVGProps<SVGSVGElement>) => (
  <SkyGlyph {...p}>
    <path d="M8.5 3a5 5 0 0 1 4.905 4.027A3 3 0 0 1 13 13h-1.5a.5.5 0 0 0 0-1H1.05a3.5 3.5 0 0 1-.713-1H9.5a.5.5 0 0 0 0-1H.035a3.5 3.5 0 0 1 0-1H7.5a.5.5 0 0 0 0-1H.337a3.5 3.5 0 0 1 3.57-1.977A5 5 0 0 1 8.5 3" />
  </SkyGlyph>
);

/* bootstrap-icons: cloud-lightning-fill */
export const ThunderIcon = (p: SVGProps<SVGSVGElement>) => (
  <SkyGlyph {...p}>
    <path d="M7.053 11.276A.5.5 0 0 1 7.5 11h1a.5.5 0 0 1 .474.658l-.28.842H9.5a.5.5 0 0 1 .39.812l-2 2.5a.5.5 0 0 1-.875-.433L7.36 14H6.5a.5.5 0 0 1-.447-.724zm6.352-7.249a5.001 5.001 0 0 0-9.499-1.004A3.5 3.5 0 1 0 3.5 10H13a3 3 0 0 0 .405-5.973" />
  </SkyGlyph>
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

/** What the sky is doing, from an Open-Meteo WMO code. */
export type SkyKind =
  "thunder" | "snow" | "rain" | "fog" | "cloud" | "partly" | "sun" | "moon";

export function skyKind(code: number, isDay = true): SkyKind {
  if (code >= 95) return "thunder";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 51 && code <= 82) return "rain";
  if (code >= 45 && code <= 48) return "fog";
  if (code === 3) return "cloud";
  if (code >= 1 && code <= 2) return "partly";
  return isDay ? "sun" : "moon";
}

const SKY_GLYPHS: Record<
  SkyKind,
  (p: SVGProps<SVGSVGElement>) => React.ReactElement
> = {
  thunder: ThunderIcon,
  snow: SnowIcon,
  rain: RainIcon,
  fog: FogIcon,
  cloud: CloudIcon,
  partly: PartlyCloudyIcon,
  sun: SunIcon,
  moon: MoonIcon,
};

/**
 * Where the BODY of a sky glyph ends, on its 16-grid, for the glyphs that
 * hang something beneath it.
 *
 * A rain cloud's lowest ink is its drops, a snow cloud's its flakes, a storm's
 * its bolt. Aligning that lowest ink to a neighbour's base stands the glyph on
 * its drops and leaves the cloud floating above the line — so these are
 * aligned by the cloud, and what falls from it hangs below the line the way a
 * descender does. Read off the Bootstrap path data: each cloud closes at this
 * y. Every other sky has nothing hanging and aligns by its full ink.
 */
const SKY_BODY_BOTTOM: Partial<Record<SkyKind, number>> = {
  rain: 11,
  snow: 10.25,
  thunder: 10,
};

/**
 * Open-Meteo WMO code → glyph.
 *
 * The kind is also stamped on the element as `data-sky`, so a stylesheet can
 * give each sky its own motion without the component knowing anything about
 * how it moves — and, where the glyph hangs something below its body, where
 * that body ends, as `data-body-bottom`, for anything that aligns it.
 */
export function WeatherIcon({
  code,
  isDay = true,
  ...props
}: SVGProps<SVGSVGElement> & { code: number; isDay?: boolean }) {
  const kind = skyKind(code, isDay);
  const Glyph = SKY_GLYPHS[kind];
  return (
    <Glyph
      data-sky={kind}
      data-body-bottom={SKY_BODY_BOTTOM[kind]}
      {...props}
    />
  );
}
