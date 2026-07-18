import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppNav } from "@/components/shell/app-nav";

export const metadata: Metadata = { title: { default: "Shelf Radar", template: "%s · Shelf Radar" }, description: "A truthful TMNT discovery and sourcing assistant", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><div className="app-shell"><header className="site-header"><a className="brand" href="/discover" aria-label="Shelf Radar home"><span className="radar-mark" aria-hidden="true">◉</span><span>Shelf Radar</span></a></header><main id="main-content">{children}</main><AppNav /></div></body></html>;
}
