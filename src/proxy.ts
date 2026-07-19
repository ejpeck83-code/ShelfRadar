import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseEnv } from "@/config/env";
import { isAuthorizedOwner, ownerChallengeHeaders } from "@/security/owner-auth";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/jobs/")) return NextResponse.next();
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();
  const env = parseEnv();
  if (env.AUTH_MODE === "development" && env.NODE_ENV !== "production") return NextResponse.next();
  if (env.AUTH_MODE === "development" && env.SHELF_RADAR_DATA_MODE === "fixture") return NextResponse.next();
  if (await isAuthorizedOwner(request, env)) return NextResponse.next();
  if (!request.nextUrl.pathname.startsWith("/api/") && request.headers.get("accept")?.includes("text/html")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }
  return new NextResponse("Authentication required", { status: 401, headers: ownerChallengeHeaders() });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"]
};
