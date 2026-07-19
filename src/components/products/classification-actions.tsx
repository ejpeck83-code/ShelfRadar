"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserProductState } from "@/domain/catalog";
import styles from "./hunt-experience.module.css";

const states: UserProductState[] = ["NEW", "HUNT", "WATCH", "IGNORE", "OWN"];
const labels: Record<UserProductState, string> = { NEW: "New", HUNT: "Hunt", WATCH: "Watch", IGNORE: "Ignore", OWN: "Own" };

export function ClassificationActions({ productId, initialState }: { productId: string; initialState: UserProductState }) {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function update(next: UserProductState) {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/products/" + productId + "/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: next, mutationId: crypto.randomUUID() })
      });
      if (!response.ok) {
        setError("Could not save classification.");
        return;
      }
      setState(next);
      router.refresh();
    });
  }

  return (
    <div>
      <div className={styles.actions} role="group" aria-label="Product classification">
        {states.map((item) => (
          <button
            key={item}
            type="button"
            className={styles.action + (item === state ? " " + styles.actionSelected : "")}
            aria-pressed={item === state}
            aria-label={labels[item]}
            disabled={pending}
            onClick={() => update(item)}
          >
            {labels[item]}
          </button>
        ))}
      </div>
      <span className={styles.srOnly} aria-live="polite">{pending ? "Saving product status" : "Product status " + labels[state]}</span>
      {error ? <p className={styles.inlineError} role="alert">{error}</p> : null}
    </div>
  );
}
