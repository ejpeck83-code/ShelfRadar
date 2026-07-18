import type { UserProductState } from "@/domain/catalog";

export type ProductIdentifierView = { kind: string; value: string };
export type AvailabilityView = { status: string; observedAt: string; storeName: string; sourceAvailable: boolean };
export type ProductView = {
  id: string;
  name: string;
  brand: string;
  line: string;
  productType: string;
  imageUrl: string | null;
  firstDetectedAt: string;
  state: UserProductState;
  identifiers: ProductIdentifierView[];
  listing: { retailer: string; url: string; priceMinor: number | null; status: string };
  availability: AvailabilityView[];
};
