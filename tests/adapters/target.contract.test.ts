import { describe, expect, it } from "vitest";
import { TargetAdapter, parseTargetPayload } from "@/adapters/retail/target";

const context = { signal: new AbortController().signal, requestId: "test", now: new Date("2026-07-18T16:00:00.000Z") };
describe("Target adapter contract", () => {
  it("declares stable capabilities and parses deterministic fixtures", async () => {
    const adapter = new TargetAdapter("fixture"); const result = await adapter.discover({ terms: ["TMNT"], pageLimit: 1 }, context);
    expect(adapter.capabilities).toEqual(["product_discovery", "listing_detail", "store_availability"]);
    expect(result.kind).toBe("success"); if (result.kind === "success") { expect(result.items).toHaveLength(3); expect(result.items.every((item) => item.provenance.sourceKey === "target")).toBe(true); }
  });
  it("distinguishes unavailable and malformed results", async () => {
    const unavailable = await new TargetAdapter("unavailable").discover({ terms: [], pageLimit: 1 }, context);
    expect(unavailable).toMatchObject({ kind: "unavailable" });
    expect(parseTargetPayload([{ title: "missing provenance" }])).toMatchObject({ kind: "malformed" });
  });
  it("bounds page requests and exposes provider failures honestly", async () => {
    expect(await new TargetAdapter("fixture").discover({ terms: [], pageLimit: 0 }, context)).toMatchObject({ kind: "malformed" });
    const provider = { discover: async () => { throw new Error("secret provider failure"); } };
    expect(await new TargetAdapter("provider", provider).discover({ terms: ["TMNT"], pageLimit: 1 }, context)).toEqual({ kind: "unavailable", reason: "Target provider request failed" });
  });
});
