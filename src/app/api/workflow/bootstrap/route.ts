import { NextResponse } from "next/server";
import { runWorkflowAction } from "@/lib/canton-client";

export async function POST() {
  try {
    return NextResponse.json(await runWorkflowAction("bootstrap"));
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
