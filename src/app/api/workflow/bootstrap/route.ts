import { NextResponse } from "next/server";
import { actionBodySchema, getWorkflowSessionState, runWorkflowAction } from "@/lib/canton-client";
import { makeWorkflowSessionCookie, readWorkflowSessionState, resolveMutableSession } from "@/lib/demo-session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({ action: "bootstrap" }));
  const parsed = actionBodySchema.safeParse({ ...body, action: "bootstrap" });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "bad_action", message: parsed.error.message }, { status: 400 });
  }

  const session = resolveMutableSession(request);
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, code: session.code, message: session.message, requiresSession: session.requiresSession },
      { status: session.status },
    );
  }

  try {
    const persistedContext = readWorkflowSessionState(request, session.sessionId);
    const response = NextResponse.json(
      await runWorkflowAction("bootstrap", {
        sessionId: session.sessionId,
        scenario: parsed.data.scenario,
        persistedContext,
      }),
    );
    if (session.setCookie) response.headers.append("Set-Cookie", session.setCookie);
    response.headers.append("Set-Cookie", makeWorkflowSessionCookie(session.sessionId, getWorkflowSessionState(session.sessionId)));
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "workflow_rejected",
        message: error instanceof Error ? error.message : "Bootstrap rejected by Canton.",
      },
      { status: 409 },
    );
  }
}
