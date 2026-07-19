import type { AppEnv } from "@/config/env";

export const OWNER_SESSION_COOKIE = "shelf_radar_owner";
export const OWNER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type OwnerSessionPayload = { v: 1; sub: string; exp: number };

export async function isAuthorizedOwner(request: Request, env: AppEnv): Promise<boolean> {
  if (env.AUTH_MODE === "development") return env.NODE_ENV !== "production";
  if (isValidOwnerCredentials(request, env)) return true;
  return verifyOwnerSessionCookie(request.headers.get("cookie"), env);
}

export function isValidOwnerCredentials(request: Request, env: AppEnv): boolean {
  const credentials = basicCredentials(request.headers.get("authorization"));
  return Boolean(credentials && env.ALLOWED_USER_EMAIL && env.AUTH_SECRET
    && constantTimeEqual(credentials.username.toLowerCase(), env.ALLOWED_USER_EMAIL.toLowerCase())
    && constantTimeEqual(credentials.password, env.AUTH_SECRET));
}

export async function createOwnerSessionToken(env: AppEnv, now = new Date()): Promise<string> {
  if (!env.ALLOWED_USER_EMAIL || !env.AUTH_SECRET) throw new Error("Owner session requires configured owner auth");
  const payload: OwnerSessionPayload = {
    v: 1,
    sub: env.ALLOWED_USER_EMAIL.toLowerCase(),
    exp: Math.floor(now.getTime() / 1000) + OWNER_SESSION_TTL_SECONDS
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${await hmac(encodedPayload, env.AUTH_SECRET)}`;
}

export function isAuthorizedJob(request: Request, env: AppEnv): boolean {
  if (!(["GET", "POST"].includes(request.method)) || request.headers.has("cookie") || !env.CRON_SECRET) return false;
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

async function verifyOwnerSessionCookie(cookieHeader: string | null, env: AppEnv, now = new Date()): Promise<boolean> {
  if (!env.ALLOWED_USER_EMAIL || !env.AUTH_SECRET) return false;
  const token = parseCookies(cookieHeader).get(OWNER_SESSION_COOKIE);
  if (!token) return false;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;
  const expectedSignature = await hmac(encodedPayload, env.AUTH_SECRET);
  if (!constantTimeEqual(signature, expectedSignature)) return false;
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<OwnerSessionPayload>;
    return payload.v === 1
      && typeof payload.sub === "string"
      && constantTimeEqual(payload.sub.toLowerCase(), env.ALLOWED_USER_EMAIL.toLowerCase())
      && typeof payload.exp === "number"
      && payload.exp > Math.floor(now.getTime() / 1000);
  } catch {
    return false;
  }
}

function parseCookies(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of cookieHeader?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    cookies.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  return cookies;
}

async function hmac(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return base64UrlEncode(signature);
}

function base64UrlEncode(value: string | Uint8Array): string {
  const binary = typeof value === "string" ? value : String.fromCharCode(...value);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(normalized + padding);
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
}
