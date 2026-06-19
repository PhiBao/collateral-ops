import { NextResponse } from "next/server";
import { getSnapshot, partyQuerySchema } from "@/lib/canton-client";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = partyQuerySchema.safeParse({ party: body.party ?? "investor" });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "bad_party", message: parsed.error.message }, { status: 400 });
  }

  const snapshot = await getSnapshot(parsed.data.party);
  return NextResponse.json({
    ok: true,
    party: snapshot.activeParty,
    recommendations: snapshot.recommendations,
    proof: snapshot.proof,
  });
}
