import { NextResponse } from "next/server";
import { OWNER_SESSION_COOKIE } from "@/security/owner-auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.cookies.set(OWNER_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 0, path: "/" });
  return response;
}
