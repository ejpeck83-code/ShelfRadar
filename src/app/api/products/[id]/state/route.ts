import { NextResponse } from "next/server";
import { z } from "zod";
import { userProductStateSchema } from "@/domain/catalog";
import { classifyProduct } from "@/features/catalog/classify";
import { parseEnv } from "@/config/env";
import { isAuthorizedOwner, isSameOriginMutation } from "@/security/owner-auth";

const bodySchema = z.object({ state: userProductStateSchema, mutationId: z.string().uuid() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const env = parseEnv();
  if (!isAuthorizedOwner(request, env) || !isSameOriginMutation(request, env)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const input = bodySchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !input.success) return NextResponse.json({ error: "Invalid classification request" }, { status: 400 });
  try { await classifyProduct(id, input.data.state, input.data.mutationId); return NextResponse.json({ ok: true, state: input.data.state }); }
  catch { return NextResponse.json({ error: "Unable to save classification" }, { status: 500 }); }
}
