import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "PAON",
  description: "Your account, orders and style — in one place.",
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
