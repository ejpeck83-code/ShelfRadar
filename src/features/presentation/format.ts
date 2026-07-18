import type { ProductIdentifierView } from "@/features/catalog/view-model";

export function formatCurrency(minor: number | null): string { return minor === null ? "Price unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100); }
export function formatFreshness(iso: string, now = new Date("2026-07-18T21:00:00.000Z")): string {
  const hours = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 3_600_000));
  return hours < 1 ? "less than an hour ago" : hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}
export function formatIdentifier(identifier: ProductIdentifierView): string { return `${identifier.kind} ${identifier.value}`; }
export function availabilityLabel(status: string): string {
  const labels: Record<string, string> = { IN_STOCK: "Retailer reports in stock", LIMITED: "Retailer reports limited", OUT_OF_STOCK: "Retailer reports out of stock", ONLINE_ONLY: "Listed online", SOURCE_UNAVAILABLE: "Source unavailable", PICKUP_UNAVAILABLE: "Pickup unavailable", PREORDER: "Preorder", UNKNOWN: "Unknown" };
  return labels[status] ?? "Unknown";
}
