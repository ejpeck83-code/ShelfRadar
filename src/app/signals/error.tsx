"use client";

import { ExperienceError } from "@/components/products/experience-states";

export default function SignalsError({ reset }: { reset: () => void }) {
  return <div className="page"><ExperienceError reset={reset} /></div>;
}
