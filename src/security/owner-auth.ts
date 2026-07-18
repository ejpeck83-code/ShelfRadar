import type { AppEnv } from "@/config/env";

export function isAuthorizedOwner(request: Request, env: AppEnv): boolean {
  if (env.AUTH_MODE === "development") return env.NODE_ENV !== "production";
  const email = request.headers.get("x-shelf-radar-user-email")?.trim().toLowerCase();
  return Boolean(email && env.ALLOWED_USER_EMAIL && email === env.ALLOWED_USER_EMAIL.toLowerCase());
}

export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  if (!origin) return fetchSite === "same-origin";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  if (!host) return false;
  try { return new URL(origin).origin === `${protocol}://${host}`; } catch { return false; }
}
