import type { Metadata } from "next";
import "./globals.css";
import { WebMcpSimulator } from "@/components/webmcp-simulator";

export const metadata: Metadata = {
  title: "YouTube Research Workspace",
  description:
    "Research YouTube alongside an AI agent — shared sources, transcripts, and cited notes, powered by WebMCP.",
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
