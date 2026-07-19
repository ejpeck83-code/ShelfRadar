import type { UserProductState } from "@/domain/catalog";
import type { SourceState } from "@/features/sources/status";

export type ProductIdentifierView = { kind: string; value: string };
export type AvailabilityView = { status: string; observedAt: string; storeName: string; sourceAvailable: boolean; sourceKind?: string; rawLabel?: string | null };
export type FieldStoreView = { id: string; name: string; city: string; region: string };
export type RetailerActionLink = { label: string; url: string; kind: "listing" | "search" };
export type RetailerListingView = {
  id: string;
  retailerKey: string;
  retailer: string;
  url: string;
  priceMinor: number | null;
  status: string;
  sourceState: SourceState;
  fieldStores: FieldStoreView[];
  actionLinks: RetailerActionLink[];
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
