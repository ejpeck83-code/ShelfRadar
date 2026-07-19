import { NextResponse } from "next/server";
import { parseEnv } from "@/config/env";
import { manualFieldCheckSchema, recordManualFieldCheck } from "@/features/hunts/manual-observation";
import { isAuthorizedOwner, isSameOriginMutation } from "@/security/owner-auth";

export async function POST(request: Request) {
  const env = parseEnv();
  if (!(await isAuthorizedOwner(request, env)) || !isSameOriginMutation(request, env)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const formData = await request.formData();
  const next = safeNextPath(stringValue(formData.get("next"))) ?? "/hunts";
  const parsed = manualFieldCheckSchema.safeParse({
    productId: stringValue(formData.get("productId")),
    listingId: optionalStringValue(formData.get("listingId")),
    retailerKey: optionalStringValue(formData.get("retailerKey")),
    storeId: optionalStringValue(formData.get("storeId")),
    status: stringValue(formData.get("status")),
    note: optionalStringValue(formData.get("note")),
    mutationId: stringValue(formData.get("mutationId"))
  });
  const redirectUrl = new URL(next, request.url);
  if (!parsed.success) {
    redirectUrl.searchParams.set("fieldCheck", "invalid");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }
  try {
    const result = await recordManualFieldCheck(parsed.data);
    redirectUrl.searchParams.set("fieldCheck", result);
  } catch {
    redirectUrl.searchParams.set("fieldCheck", "failed");
  }
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function optionalStringValue(value: FormDataEntryValue | null): string | undefined {
  const string = stringValue(value).trim();
  return string ? string : undefined;
}

function safeNextPath(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value.startsWith("/api/") ? null : value;
}
