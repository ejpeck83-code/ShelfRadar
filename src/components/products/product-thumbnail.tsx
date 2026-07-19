import Image from "next/image";
import styles from "./hunt-experience.module.css";

export function ProductThumbnail({ name, imageUrl, priority = false }: { name: string; imageUrl: string | null; priority?: boolean }) {
  return (
    <div className={styles.thumbnail}>
      {imageUrl ? (
        <Image src={imageUrl} alt={"Fictional fixture package for " + name} width={120} height={150} sizes="(max-width: 699px) 86px, 112px" priority={priority} />
      ) : (
        <span className={styles.fallback}>
          <span className={styles.fallbackMark} aria-hidden="true">◎</span>
          Image unavailable
        </span>
      )}
    </div>
  );
}
