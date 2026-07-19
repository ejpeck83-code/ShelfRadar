import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseEnv } from "@/config/env";
import { isAuthorizedOwner, ownerChallengeHeaders } from "@/security/owner-auth";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/jobs/")) return NextResponse.next();
  const env = parseEnv();
  if (env.AUTH_MODE === "development" && env.NODE_ENV !== "production") return NextResponse.next();
  if (env.AUTH_MODE === "development" && env.SHELF_RADAR_DATA_MODE === "fixture") return NextResponse.next();
  if (isAuthorizedOwner(request, env)) return NextResponse.next();
  return new NextResponse("Authentication required", { status: 401, headers: ownerChallengeHeaders() });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"]
};
