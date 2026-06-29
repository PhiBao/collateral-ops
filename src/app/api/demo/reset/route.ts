import { NextResponse } from "next/server";
import { resetWorkflowContext } from "@/lib/canton-client";
import { clearWorkflowSessionCookie, resolveMutableSession } from "@/lib/demo-session";

export async function POST(request: Request) {
  const session = resolveMutableSession(request);
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, code: session.code, message: session.message, requiresSession: session.requiresSession },
      { status: session.status },
    );
  }

  resetWorkflowContext(session.sessionId);
  const response = NextResponse.json({ ok: true, message: "Demo session reset." });
  if (session.setCookie) response.headers.append("Set-Cookie", session.setCookie);
  response.headers.append("Set-Cookie", clearWorkflowSessionCookie());
  return response;
}
