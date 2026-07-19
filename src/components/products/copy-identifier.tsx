"use client";

import { useState } from "react";
import styles from "./hunt-experience.module.css";

export function CopyIdentifier({ value, kind }: { value: string; kind: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  }

  return (
    <>
      <button className={styles.copyButton} type="button" onClick={copy} aria-label={"Copy " + kind + " " + value}>
        {copied ? "Done" : "Copy"}
      </button>
      <span className={styles.srOnly} aria-live="polite">{copied ? kind + " copied" : ""}</span>
    </>
  );
}
