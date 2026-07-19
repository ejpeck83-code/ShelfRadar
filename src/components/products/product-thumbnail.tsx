import Image from "next/image";

export function ProductThumbnail({ name, imageUrl, priority = false }: { name: string; imageUrl: string | null; priority?: boolean }) {
  const safeImageUrl = isSafeProductImageUrl(imageUrl) ? imageUrl : null;
  return <div className="product-thumb">{safeImageUrl ? <Image src={safeImageUrl} alt={`Product image for ${name}`} width={120} height={150} sizes="(max-width: 699px) 82px, 112px" priority={priority} /> : <span className="image-unavailable">Image unavailable</span>}</div>;
}

export function isSafeProductImageUrl(value: string | null): value is string {
  return Boolean(value?.startsWith("/products/") && !value.includes("..") && !value.includes("\\"));
}
