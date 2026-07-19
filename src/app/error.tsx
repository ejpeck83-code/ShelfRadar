"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page"><section className="empty-state"><h1>Evidence could not load</h1><p>Cached data was not replaced with an inventory claim. Check source status or try again.</p><button className="primary-button" type="button" onClick={reset}>Try again</button></section></div>;
}
