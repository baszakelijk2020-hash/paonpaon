import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "PAON",
  description:
    "The digital customer and operating platform for premium retail houses.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
