import type { Metadata } from "next";
import { listProducts } from "@/features/catalog/queries";
import { ProductRow } from "@/components/products/product-row";
import { rankStore } from "@/ranking/rank-store";

export const metadata: Metadata = { title: "Hunts" };
export const dynamic = "force-dynamic";
export default async function HuntsPage() {
  const hunts = (await listProducts()).filter((product) => product.state === "HUNT");
  const exampleRank = rankStore({ productId: hunts[0]?.id ?? "none", storeId: "fishers", calculatedAt: new Date("2026-07-18T21:00:00.000Z"), storePreference: 0, evidence: hunts[0] ? [{ reference: "target-fixture:fishers", observedAt: new Date("2026-07-18T16:00:00.000Z"), recentRetailPositive: true }] : [] });
  return <div className="page"><div className="page-heading"><h1>Hunts</h1><p>Products you are actively looking for.</p></div>{hunts.length ? <><div className="lead-summary"><h2>Target Fishers · {labelText(exampleRank.label)}</h2><p>Ranked from limited fixture evidence, not a promise of shelf inventory.</p>{exampleRank.factors.map((factor) => <div className="factor" key={factor.code}><span>{factor.points > 0 ? "+" : ""}{factor.points}</span><p>{factor.explanation} · observed {new Date(factor.observedAt).toLocaleString("en-US", { timeZone: "America/Indiana/Indianapolis" })}</p></div>)}</div><div className="product-list">{hunts.map((product, index) => <ProductRow key={product.id} product={product} priority={index === 0} />)}</div></> : <section className="empty-state"><h2>No active hunts</h2><p>Mark a discovery as Hunt and it will appear here with transparent store leads.</p><a className="primary-link" href="/discover">Browse discoveries</a></section>}</div>;
}
function labelText(label: string): string { return ({ STRONG: "Strong lead", POSSIBLE: "Possible lead", WEAK: "Weak lead", INSUFFICIENT: "Insufficient evidence" } as Record<string, string>)[label] ?? "Insufficient evidence"; }
