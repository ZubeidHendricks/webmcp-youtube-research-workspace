import type { Metadata } from "next";
import "./globals.css";
import { WebMcpSimulator } from "@/components/webmcp-simulator";

export const metadata: Metadata = {
  title: "Dispatch",
  description:
    "A shared room where media buyers and their agents write the weekly ad-account decision memo together — every finding cited, powered by WebMCP.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <WebMcpSimulator />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
