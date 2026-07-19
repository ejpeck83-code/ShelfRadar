import styles from "./hunt-experience.module.css";

export function EvidenceNotice({ children }: { children: React.ReactNode }) {
  return (
    <aside className={styles.notice} aria-label="Source status">
      <span className={styles.noticeDot} aria-hidden="true" />
      <span>{children}</span>
    </aside>
  );
}
