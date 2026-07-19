import type { AppEnv } from "@/config/env";

export function isAuthorizedOwner(request: Request, env: AppEnv): boolean {
  if (env.AUTH_MODE === "development") return env.NODE_ENV !== "production";
  const credentials = basicCredentials(request.headers.get("authorization"));
  return Boolean(credentials && env.ALLOWED_USER_EMAIL && env.AUTH_SECRET
    && constantTimeEqual(credentials.username.toLowerCase(), env.ALLOWED_USER_EMAIL.toLowerCase())
    && constantTimeEqual(credentials.password, env.AUTH_SECRET));
}

export function isAuthorizedJob(request: Request, env: AppEnv): boolean {
  if (request.method !== "POST" || request.headers.has("cookie") || !env.CRON_SECRET) return false;
  const authorization = request.headers.get("authorization");
  return Boolean(authorization?.startsWith("Bearer ") && constantTimeEqual(authorization.slice(7), env.CRON_SECRET));
}

export function isSameOriginMutation(request: Request, env?: AppEnv): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  if (!origin) return fetchSite === "same-origin";
  if (env?.NODE_ENV === "production") return origin === new URL(env.APP_BASE_URL).origin;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  if (!host) return false;
  try { return new URL(origin).origin === `${protocol}://${host}`; } catch { return false; }
}

export function ownerChallengeHeaders(): HeadersInit {
  return { "www-authenticate": 'Basic realm="Shelf Radar", charset="UTF-8"', "cache-control": "no-store" };
}

function basicCredentials(value: string | null): { username: string; password: string } | null {
  if (!value?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(value.slice(6));
    const separator = decoded.indexOf(":");
    return separator > 0 ? { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) } : null;
  } catch {
    return null;
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
}
