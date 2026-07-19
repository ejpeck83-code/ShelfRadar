import { NextResponse } from "next/server";
import { parseEnv } from "@/config/env";
import { createOwnerSessionToken, isValidOwnerCredentials, OWNER_SESSION_COOKIE, OWNER_SESSION_TTL_SECONDS } from "@/security/owner-auth";

export async function POST(request: Request) {
  const env = parseEnv();
  const formData = await request.formData();
  const username = stringValue(formData.get("username"));
  const password = stringValue(formData.get("password"));
  const next = safeNextPath(stringValue(formData.get("next"))) ?? "/discover";
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", next);

  const authorization = `Basic ${btoa(`${username}:${password}`)}`;
  if (!isValidOwnerCredentials(new Request(request.url, { headers: { authorization } }), env)) {
    loginUrl.searchParams.set("error", "1");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  response.cookies.set(OWNER_SESSION_COOKIE, await createOwnerSessionToken(env), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: OWNER_SESSION_TTL_SECONDS,
    path: "/"
  });
  return response;
}

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function safeNextPath(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value.startsWith("/api/") ? null : value;
}
