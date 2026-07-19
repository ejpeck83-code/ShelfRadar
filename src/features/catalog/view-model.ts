import type { UserProductState } from "@/domain/catalog";
import type { SourceState } from "@/features/sources/status";

export type ProductIdentifierView = { kind: string; value: string };
export type AvailabilityView = { status: string; observedAt: string; storeName: string; sourceAvailable: boolean };
export type RetailerListingView = {
  id: string;
  retailerKey: string;
  retailer: string;
  url: string;
  priceMinor: number | null;
  status: string;
  sourceState: SourceState;
  availability: AvailabilityView[];
};
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
  listings: RetailerListingView[];
  matchingSummary: string;
};
