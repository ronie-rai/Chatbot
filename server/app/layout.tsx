import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OFA Sports Foundation — AI Chat & Analytics Hub",
  description: "Official OFA Sports Foundation AI Assistant, Bookings & Analytics Platform",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
