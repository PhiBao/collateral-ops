import { NextResponse } from "next/server";
import { getSnapshot, partyQuerySchema } from "@/lib/canton-client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = partyQuerySchema.safeParse({ party: url.searchParams.get("party") ?? "investor" });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "bad_party", message: parsed.error.message }, { status: 400 });
  }

  return NextResponse.json(await getSnapshot(parsed.data.party));
}
