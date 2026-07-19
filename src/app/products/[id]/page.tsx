import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailExperience } from "@/components/products/product-detail-experience";
import { getProduct } from "@/features/catalog/queries";
import { getProductDetail } from "@/features/presentation/hunt-experience";

export const metadata: Metadata = { title: "Product detail" };
export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  return <ProductDetailExperience detail={getProductDetail(product)} />;
}
