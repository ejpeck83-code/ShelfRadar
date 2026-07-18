"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/discover", label: "Discover", icon: "◉" },
  { href: "/hunts", label: "Hunts", icon: "⌖" },
  { href: "/signals", label: "Signals", icon: "⌁" },
  { href: "/status", label: "Status", icon: "○" }
] as const;

export function AppNav() {
  const pathname = usePathname();
  return <nav className="app-nav" aria-label="Primary">{items.map((item) => { const active = pathname.startsWith(item.href) || (item.href === "/discover" && pathname.startsWith("/products")); return <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}><span aria-hidden="true" className="nav-icon">{item.icon}</span><span>{item.label}</span></Link>; })}</nav>;
}
