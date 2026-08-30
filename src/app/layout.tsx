import type { Metadata } from "next";
import "./globals.css";
import { WebMcpSimulator } from "@/components/webmcp-simulator";

export const metadata: Metadata = {
  title: "YouGo",
  description:
    "A shared research workspace where people and their agents collect video sources and build cited notes together, powered by WebMCP.",
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
