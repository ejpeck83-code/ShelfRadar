import Image from "next/image";

export function ProductThumbnail({ name, imageUrl, priority = false }: { name: string; imageUrl: string | null; priority?: boolean }) {
  return <div className="product-thumb">{imageUrl ? <Image src={imageUrl} alt={`Fictional fixture package for ${name}`} width={120} height={150} sizes="(max-width: 699px) 82px, 112px" priority={priority} /> : <span className="image-unavailable">Image unavailable</span>}</div>;
}
