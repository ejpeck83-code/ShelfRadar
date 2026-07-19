import type { Metadata } from "next";
import { HuntsExperience } from "@/components/hunts/hunts-experience";
import { listProducts } from "@/features/catalog/queries";
import { getHuntLeads } from "@/features/presentation/hunt-experience";

export const metadata: Metadata = { title: "Hunts" };
export const dynamic = "force-dynamic";

export default async function HuntsPage() {
  const products = await listProducts();
  const hunts = products
    .filter((product) => product.state === "HUNT")
    .map((product) => ({ product, leads: getHuntLeads(product) }));
  return <HuntsExperience hunts={hunts} />;
}
