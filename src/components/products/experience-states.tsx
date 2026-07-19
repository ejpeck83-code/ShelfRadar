import Link from "next/link";
import styles from "./hunt-experience.module.css";

export function ExperienceLoading({ label }: { label: string }) {
  return (
    <div className={"page " + styles.experience}>
      <section className={styles.loading} aria-busy="true" aria-label={label}>
        <span className={styles.srOnly}>{label}</span>
        <div className={styles.loadingBar} />
        <div className={styles.loadingBar} />
        <div className={styles.loadingBar} />
      </section>
    </div>
  );
}

export function ExperienceEmpty({ title, body, href, linkLabel }: { title: string; body: string; href?: string; linkLabel?: string }) {
  return (
    <section className={styles.empty}>
      <h2>{title}</h2>
      <p>{body}</p>
      {href && linkLabel ? <Link className={styles.primaryLink} href={href}>{linkLabel}</Link> : null}
    </section>
  );
}

export function ExperienceError({ reset }: { reset: () => void }) {
  return (
    <section className={styles.errorState} role="alert">
      <h2>Evidence could not be loaded</h2>
      <p>Cached data may still be available on another screen. No source failure is being treated as an out-of-stock result.</p>
      <button className={styles.retryButton} type="button" onClick={reset}>Try again</button>
    </section>
  );
}
