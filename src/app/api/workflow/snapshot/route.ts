import { NextResponse } from "next/server";
import { getSnapshot, partyQuerySchema } from "@/lib/canton-client";
import { readWorkflowSessionState, resolveReadSession } from "@/lib/demo-session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = partyQuerySchema.safeParse({ party: url.searchParams.get("party") ?? "investor" });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "bad_party", message: parsed.error.message }, { status: 400 });
  }

  const sessionId = resolveReadSession(request);
  return NextResponse.json(await getSnapshot(parsed.data.party, sessionId, readWorkflowSessionState(request, sessionId)));
}
