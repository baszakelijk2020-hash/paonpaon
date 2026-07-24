import type { CSSProperties, ReactNode } from "react";

export interface RetailerThemeTokens {
  accentColor: string;
  surfaceColor: string;
  inkColor: string;
  displayFont: "paon_editorial" | "heritage" | "modern";
  bodyFont: "quiet_sans" | "humanist";
  cornerStyle: "tailored" | "soft" | "architectural";
}

const DISPLAY_FONTS = {
  paon_editorial: "var(--font-display)",
  heritage: '"Iowan Old Style", "Baskerville", Georgia, serif',
  modern: '"Helvetica Neue", Arial, sans-serif',
} as const;

const BODY_FONTS = {
  quiet_sans: "var(--font-sans)",
  humanist: '"Avenir Next", Avenir, "Segoe UI", sans-serif',
} as const;

const CORNERS = {
  tailored: "0.25rem",
  soft: "1.25rem",
  architectural: "0rem",
} as const;

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

export function retailerThemeStyle(theme: RetailerThemeTokens): ThemeStyle {
  return {
    "--retailer-accent": theme.accentColor,
    "--retailer-surface": theme.surfaceColor,
    "--retailer-ink": theme.inkColor,
    "--font-retailer-display": DISPLAY_FONTS[theme.displayFont],
    "--font-retailer-body": BODY_FONTS[theme.bodyFont],
    "--retailer-radius": CORNERS[theme.cornerStyle],
    "--color-stone-50": theme.surfaceColor,
    "--color-stone-900": theme.inkColor,
  };
}

export function RetailerTheme({
  theme,
  children,
  className,
}: {
  theme: RetailerThemeTokens;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`retailer-theme min-h-full ${className ?? ""}`}
      style={retailerThemeStyle(theme)}
    >
      {children}
    </div>
  );
}
