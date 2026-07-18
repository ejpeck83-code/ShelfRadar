import type { Metadata } from "next";
export const metadata: Metadata = { title: "Signals" };
export default function SignalsPage() { return <div className="page"><div className="page-heading"><h1>Signals</h1><p>A chronological evidence feed will grow as approved sources are added.</p></div><section className="empty-state"><h2>No crowd signals in this milestone</h2><p>Target fixture discoveries are available in Discover. Reddit and Ross crowd-inventory adapters are deliberately not active yet.</p></section></div>; }
