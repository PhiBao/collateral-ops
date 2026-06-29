import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import type { WorkflowSessionState } from "./types";

export const demoSessionCookieName = "collateralops_demo_session";
export const workflowContextCookieName = "collateralops_workflow_context";
export const demoSessionHeaderName = "x-demo-session-id";
export const demoAccessKeyHeaderName = "x-demo-access-key";

const sessionTtlSeconds = 60 * 60 * 6;
const sessionIdPattern = /^[a-zA-Z0-9_-]{12,80}$/;

export interface DemoSessionResolution {
  ok: true;
  sessionId: string;
  setCookie?: string;
}

export interface DemoSessionRejection {
  ok: false;
  status: number;
  code: string;
  message: string;
  requiresSession: boolean;
}

export function readDemoSessionIdFromCookieValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = verifySignedSession(value);
  return parsed ?? undefined;
}

export function previewSessionId() {
  return "preview-session";
}

export function resolveReadSession(request: Request): string {
  return readDemoSessionId(request) ?? previewSessionId();
}

export function resolveMutableSession(request: Request): DemoSessionResolution | DemoSessionRejection {
  const existingSessionId = readDemoSessionId(request);
  if (existingSessionId) return { ok: true, sessionId: existingSessionId };

  if (isAccessKeyConfigured()) {
    return {
      ok: false,
      status: 401,
      code: "demo_session_required",
      message: "Enter the demo access key before submitting Canton commands.",
      requiresSession: true,
    };
  }

  const sessionId = createDemoSessionId();
  return {
    ok: true,
    sessionId,
    setCookie: makeDemoSessionCookie(sessionId),
  };
}

export async function createDemoSession(request: Request): Promise<DemoSessionResolution | DemoSessionRejection> {
  const body = await request.json().catch(() => ({}));
  const submittedKey = String(body.accessKey ?? request.headers.get(demoAccessKeyHeaderName) ?? "");
  const expectedKey = process.env.DEMO_ACCESS_KEY;

  if (expectedKey && submittedKey !== expectedKey) {
    return {
      ok: false,
      status: 401,
      code: "bad_demo_access_key",
      message: "The demo access key is invalid.",
      requiresSession: true,
    };
  }

  const sessionId = createDemoSessionId();
  return {
    ok: true,
    sessionId,
    setCookie: makeDemoSessionCookie(sessionId),
  };
}

export function clearDemoSessionCookie() {
  return `${demoSessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieSuffix()}`;
}

export function readWorkflowSessionState(request: Request, sessionId: string): WorkflowSessionState | undefined {
  return readWorkflowSessionStateFromCookieValue(readCookie(request.headers.get("cookie"), workflowContextCookieName), sessionId);
}

export function readWorkflowSessionStateFromCookieValue(
  value: string | undefined,
  sessionId: string,
): WorkflowSessionState | undefined {
  const envelope = verifySignedJson<{ sessionId: string; state: WorkflowSessionState }>(value);
  if (!envelope || envelope.sessionId !== sessionId) return undefined;
  return sanitizeWorkflowState(envelope.state);
}

export function makeWorkflowSessionCookie(sessionId: string, state: WorkflowSessionState) {
  const value = signJson({ sessionId, state: sanitizeWorkflowState(state) });
  return `${workflowContextCookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionTtlSeconds}${secureCookieSuffix()}`;
}

export function clearWorkflowSessionCookie() {
  return `${workflowContextCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieSuffix()}`;
}

function readDemoSessionId(request: Request): string | undefined {
  const cookieSession = readDemoSessionIdFromCookieValue(readCookie(request.headers.get("cookie"), demoSessionCookieName));
  if (cookieSession) return cookieSession;

  if (!isAccessKeyConfigured()) {
    const headerSession = request.headers.get(demoSessionHeaderName);
    if (headerSession && sessionIdPattern.test(headerSession)) return headerSession;
  }

  return undefined;
}

function createDemoSessionId() {
  return randomUUID().replace(/-/g, "");
}

function makeDemoSessionCookie(sessionId: string) {
  const value = signSessionId(sessionId);
  return `${demoSessionCookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionTtlSeconds}${secureCookieSuffix()}`;
}

function signSessionId(sessionId: string) {
  return `${sessionId}.${signatureFor(sessionId)}`;
}

function verifySignedSession(value: string): string | null {
  const [sessionId, signature] = value.split(".");
  if (!sessionId || !signature || !sessionIdPattern.test(sessionId)) return null;

  const expected = signatureFor(sessionId);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length) return null;
  return timingSafeEqual(left, right) ? sessionId : null;
}

function signJson(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${signatureFor(payload)}`;
}

function verifySignedJson<T>(value: string | undefined): T | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = signatureFor(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function signatureFor(sessionId: string) {
  return createHmac("sha256", sessionSecret()).update(sessionId).digest("base64url");
}

function sessionSecret() {
  return process.env.DEMO_SESSION_SECRET ?? process.env.DEMO_ACCESS_KEY ?? "collateralops-local-demo-session";
}

function isAccessKeyConfigured() {
  return Boolean(process.env.DEMO_ACCESS_KEY);
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function secureCookieSuffix() {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

function sanitizeWorkflowState(state: WorkflowSessionState | undefined): WorkflowSessionState {
  if (!state) return {};
  return {
    parties: state.parties,
    activeAtOffset: typeof state.activeAtOffset === "number" ? state.activeAtOffset : undefined,
    scenario: state.scenario,
    lastAction: state.lastAction,
  };
}
