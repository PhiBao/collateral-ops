import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  demoSessionCookieName,
  previewSessionId,
  readDemoSessionIdFromCookieValue,
  readWorkflowSessionStateFromCookieValue,
  workflowContextCookieName,
} from "@/lib/demo-session";
import { getSnapshot, runWorkflowAction } from "@/lib/canton-client";
import type { WorkflowAction, WorkflowSnapshot } from "@/lib/types";

const agentRequestSchema = z.object({
  activeParty: z.enum(["investor", "securedParty", "custodian", "auditor"]).default("investor"),
  observationOnly: z.boolean().default(true),
});

const llmApiKey = process.env.LLM_API_KEY;
const llmBaseUrl = process.env.LLM_BASE_URL ?? "https://api.dgrid.ai";
const llmModel = process.env.LLM_MODEL ?? "openai/gpt-4o";
const demoAccessKey = process.env.DEMO_ACCESS_KEY;

function guardDemoSession(request: NextRequest) {
  if (!demoAccessKey) return;

  const cookie = request.cookies.get(demoSessionCookieName);
  const sessionId = readDemoSessionIdFromCookieValue(cookie?.value);
  if (!sessionId || sessionId === "preview-session") {
    throw NextResponse.json(
      { requiresSession: true, message: "Agent requires an active demo session.", code: "demo_session_required" },
      { status: 401 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    guardDemoSession(request);

    const body = await request.json().catch(() => ({}));
    const parsed = agentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "bad_request", message: "Invalid agent request body.", errors: parsed.error.issues }, { status: 400 });
    }

    const { activeParty, observationOnly } = parsed.data;
    const cookieStore = request.cookies;
    const sessionId = readDemoSessionIdFromCookieValue(cookieStore.get(demoSessionCookieName)?.value) ?? previewSessionId();
    const persistedContext = readWorkflowSessionStateFromCookieValue(cookieStore.get(workflowContextCookieName)?.value, sessionId);
    const snapshot = await getSnapshot(activeParty, sessionId, persistedContext);

    const recommendation = await callLLM(snapshot);

    if (!observationOnly && recommendation.action && (snapshot.nextActions as string[]).includes(recommendation.action)) {
      try {
        await runWorkflowAction(recommendation.action as WorkflowAction, { sessionId, persistedContext });
      } catch (error) {
        return NextResponse.json({
          ok: true,
          action: recommendation.action,
          reasoning: recommendation.reasoning,
          confidence: recommendation.confidence,
          executed: false,
          executionError: error instanceof Error ? error.message : "Failed to execute agent-chosen action on Canton.",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      action: recommendation.action,
      reasoning: recommendation.reasoning,
      confidence: recommendation.confidence,
      executed: !observationOnly,
      mode: "llm-agent",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;

    return NextResponse.json({
      ok: false,
      code: "agent_failed",
      message: error instanceof Error ? error.message : "Agent evaluation failed.",
    }, { status: 500 });
  }
}

async function callLLM(snapshot: WorkflowSnapshot) {
  if (!llmApiKey) {
    return fallbackRecommendation(snapshot);
  }

  const stageLabel = snapshot.stage ?? "call-open";
  const nextActions = (snapshot.nextActions ?? []) as string[];
  const activeParty = snapshot.activeParty ?? "investor";
  const recommendations = snapshot.recommendations as Array<{ cusip: string; selectable: boolean; coverageRatio: number }> | undefined;
  const topRec = recommendations?.find((r) => r.selectable) ?? recommendations?.[0];

  const systemPrompt = [
    "You are an institutional repo/collateral operations agent on the Canton network.",
    "Your job is to observe the current workflow state and recommend the NEXT Canton action.",
    "",
    `Current workflow stage: ${stageLabel}`,
    `Viewing as: ${activeParty}`,
    `Available actions: ${nextActions.join(", ")}`,
    topRec ? `Top collateral pick: ${topRec.cusip} (selectable: ${topRec.selectable}, coverage: ${Math.round(topRec.coverageRatio * 100)}%)` : "No recommendation data yet.",
    "",
    "Rules:",
    "- Only recommend actions in the available list.",
    "- Explain WHY this action is the right next step.",
    "- If there are multiple actions, pick the safest or most urgent.",
    "- 'settle' means atomic DvP repo settlement (cash+collateral in one Canton tx). Use it when available.",
    "- 'bootstrap' starts a fresh workflow — only after reset or first run.",
    "",
    "Return ONLY a JSON object with these keys:",
    '{ "action": "offer", "reasoning": "short explanation", "confidence": 0.95 }',
    "No markdown, no code fences, just the JSON object.",
  ].join("\n");

  try {
    const response = await fetch(`${llmBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llmApiKey}`,
      },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "What is the next Canton workflow action?" },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "LLM call failed");
      throw new Error(`LLM API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const clean = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    try {
      const parsed = JSON.parse(clean);
      const action = String(parsed.action ?? "").toLowerCase().trim();
      if (nextActions.includes(action)) {
        return {
          action: action as string,
          reasoning: String(parsed.reasoning ?? "Agent selected this action based on the current workflow state."),
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
        };
      }
      return fallbackRecommendation(snapshot);
    } catch {
      return fallbackRecommendation(snapshot);
    }
  } catch {
    return fallbackRecommendation(snapshot);
  }
}

function fallbackRecommendation(snapshot: WorkflowSnapshot) {
  const nextActions = snapshot.nextActions as WorkflowAction[];
  const action: WorkflowAction = nextActions[0] ?? "bootstrap";

  const intentMap: Record<WorkflowAction, string> = {
    bootstrap: "Fresh workflow — bootstrapping parties, positions, and the margin call on Canton.",
    offer: "The investor should offer the best eligible Treasury position to respond to the margin call.",
    lock: "The custodian should lock the pledged asset so it cannot be reused.",
    accept: "The secured party should accept the locked collateral as an active pledge.",
    settle: "Atomic DvP repo settlement — cash and collateral confirmed in one Canton transaction.",
    release: "Exposure normalized — safe to release the collateral.",
    default: "Cure window expired — exercising the default closeout path.",
    seize: "Default path confirmed — collateral seizure closeout.",
  };

  return {
    action,
    reasoning: intentMap[action] ?? `Deterministic recommendation: ${action} is the next valid Canton step.`,
    confidence: 0.85,
  };
}
