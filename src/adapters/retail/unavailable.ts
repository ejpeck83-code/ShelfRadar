import type { AdapterCapability, AdapterResult, RawListing, RetailDiscoveryAdapter } from "@/domain/adapters";

export class UnavailableRetailAdapter implements RetailDiscoveryAdapter {
  readonly parserVersion = "unavailable-v1";
  readonly capabilities: readonly AdapterCapability[];
  constructor(readonly sourceKey: string, capabilities: readonly AdapterCapability[], private readonly reason: string) { this.capabilities = capabilities; }
  async discover(): Promise<AdapterResult<RawListing>> {
    return { kind: "unavailable", reason: this.reason };
  }
}
