import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OFA Sports Foundation — AI Chat & Analytics Hub",
  description: "Official OFA Sports Foundation AI Assistant, Bookings & Analytics Platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OFA Assistant",
    startupImage: "/icons/icon-512.png",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/icon-180.png", sizes: "180x180" },
      { url: "/icons/icon-512.png", sizes: "512x512" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "OFA Assistant",
    "theme-color": "#25D366",
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
