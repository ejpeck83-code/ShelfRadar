"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserProductState } from "@/domain/catalog";

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
      try {
        const response = await fetch(`/api/products/${productId}/state`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: next, mutationId: crypto.randomUUID() }) });
        if (!response.ok) { setError("Could not save classification."); return; }
        setState(next);
        router.refresh();
      } catch {
        setError("Could not save classification.");
      }
    });
  }
  return <div><div className="classification" aria-label="Product classification">{states.map((item) => <button key={item} type="button" className={item === state ? "selected" : ""} aria-pressed={item === state} disabled={pending} onClick={() => update(item)}>{labels[item]}</button>)}</div>{error ? <p className="inline-error" role="alert">{error}</p> : null}</div>;
}
