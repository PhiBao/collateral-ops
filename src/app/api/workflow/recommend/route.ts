import { NextResponse } from "next/server";
import { getSnapshot, partyQuerySchema } from "@/lib/canton-client";
import { readWorkflowSessionState, resolveReadSession } from "@/lib/demo-session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = partyQuerySchema.safeParse({ party: body.party ?? "investor" });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "bad_party", message: parsed.error.message }, { status: 400 });
  }

  const sessionId = resolveReadSession(request);
  const snapshot = await getSnapshot(parsed.data.party, sessionId, readWorkflowSessionState(request, sessionId));
  return NextResponse.json({
    ok: true,
    party: snapshot.activeParty,
    recommendations: snapshot.recommendations,
    proof: snapshot.proof,
  });
}
