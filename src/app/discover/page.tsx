import type { Metadata } from "next";
import { DiscoverExperience } from "@/components/discover/discover-experience";
import { listProducts } from "@/features/catalog/queries";
import { toDiscoverPresentation } from "@/features/presentation/hunt-experience";

export const metadata: Metadata = { title: "Discover" };
export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const products = toDiscoverPresentation(await listProducts());
  return <DiscoverExperience products={products} />;
}
