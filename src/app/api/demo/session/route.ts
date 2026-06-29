import { NextResponse } from "next/server";
import { clearWorkflowSessionCookie, createDemoSession } from "@/lib/demo-session";

export async function POST(request: Request) {
  const session = await createDemoSession(request);

  if (!session.ok) {
    return NextResponse.json(
      { ok: false, code: session.code, message: session.message, requiresSession: session.requiresSession },
      { status: session.status },
    );
  }

  const response = NextResponse.json({ ok: true, sessionId: session.sessionId });
  if (session.setCookie) response.headers.append("Set-Cookie", session.setCookie);
  response.headers.append("Set-Cookie", clearWorkflowSessionCookie());
  return response;
}
