import { NextResponse } from "next/server";
import { actionBodySchema, runWorkflowAction } from "@/lib/canton-client";

export async function POST(request: Request) {
  const parsed = actionBodySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "bad_action", message: parsed.error.message }, { status: 400 });
  }

  try {
    return NextResponse.json(await runWorkflowAction(parsed.data.action));
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "workflow_rejected",
        message: error instanceof Error ? error.message : "Workflow action rejected.",
      },
      { status: 409 },
    );
  }
}
