import type { Metadata } from "next";
import { parseEnv } from "@/config/env";

export const metadata: Metadata = { title: "Log in" };

type LoginPageProps = {
  searchParams?: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const env = parseEnv();
  const params = await searchParams;
  const next = safeNextPath(params?.next) ?? "/discover";
  const hasError = params?.error === "1";
  return (
    <section className="login-page" aria-labelledby="login-title">
      <div className="login-panel">
        <p className="login-kicker">Private hunt workspace</p>
        <h1 id="login-title">Log in to Shelf Radar</h1>
        <p>Use your owner login once and this device will stay remembered for 30 days.</p>
        <form className="login-form" action="/api/auth/login" method="post">
          <input type="hidden" name="next" value={next} />
          <label>
            Username
            <input name="username" autoComplete="username" inputMode="text" defaultValue={env.ALLOWED_USER_EMAIL ?? ""} required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {hasError ? <p className="inline-error" role="alert">That login did not match the owner credentials.</p> : null}
          <button className="primary-button" type="submit">Log in</button>
        </form>
      </div>
    </section>
  );
}

function safeNextPath(value: string | undefined): string | null {
  if (!value?.startsWith("/") || value.startsWith("//")) return null;
  return value.startsWith("/api/") ? null : value;
}
