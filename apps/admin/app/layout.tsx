import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "PAON Admin",
  description: "Platform administration console for PAON staff.",
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
