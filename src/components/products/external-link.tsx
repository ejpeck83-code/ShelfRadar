import type { ReactNode } from "react";
import styles from "./hunt-experience.module.css";

export function ExternalLink({ href, children, label }: { href: string; children: ReactNode; label: string }) {
  return (
    <a className={styles.externalLink} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
      {children} <span aria-hidden="true">↗</span>
    </a>
  );
}
