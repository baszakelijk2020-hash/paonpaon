import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PAON",
    template: "%s · PAON",
  },
  description:
    "The digital customer and operating platform for premium retail houses.",
  metadataBase: new URL("https://paonpaon-customer.vercel.app"),
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "PAON",
    title: "PAON — the relationship is the product",
    description:
      "The digital customer and operating platform for premium retail houses.",
    images: [
      {
        url: "https://www.nebelspiegel.com/images/smaller/6088.webp",
        width: 1200,
        height: 630,
        alt: "PAON — premium retail, connected",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PAON — the relationship is the product",
    description:
      "The digital customer and operating platform for premium retail houses.",
    images: ["https://www.nebelspiegel.com/images/smaller/6088.webp"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PAON",
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
        <meta name="apple-mobile-web-app-title" content="PAON" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body>{children}</body>
    </html>
  );
}
