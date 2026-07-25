import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "PAON Admin",
  description: "Platform administration console for PAON staff.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PAON Admin",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "theme-color": "#1a1a1a",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#1a1a1a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="PAON Admin" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body>{children}</body>
    </html>
  );
}
