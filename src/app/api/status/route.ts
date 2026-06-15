import { NextResponse } from "next/server";
import { checkCantonHealth } from "@/lib/canton-client";

export async function GET() {
  return NextResponse.json(await checkCantonHealth());
}
