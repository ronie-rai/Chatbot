import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chatbot SaaS API",
  description: "WhatsApp-style AI Chatbot SaaS — API Server",
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
