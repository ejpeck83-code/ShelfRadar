import type { Metadata } from "next";
import { SignalsExperience } from "@/components/signals/signals-experience";
import { listProducts } from "@/features/catalog/queries";
import { getSignals } from "@/features/presentation/hunt-experience";

export const metadata: Metadata = { title: "Signals" };
export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  return <SignalsExperience signals={getSignals(await listProducts())} />;
}
