"use client";

import { ArrowRight, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import type { PartyRole, WorkflowAction, WorkflowScenario } from "@/lib/types";

const actionCopy: Record<WorkflowAction, { label: string; helper: string }> = {
  bootstrap: {
    label: "Start workflow",
    helper: "Create parties, Treasury inventory, private exposure terms, and the first margin call.",
  },
  offer: {
    label: "Offer recommended collateral",
    helper: "Submit the lowest-surplus eligible Treasury position as AtlasFund's response.",
  },
  lock: {
    label: "Lock asset in custody",
    helper: "Confirm the pledged Treasury cannot be reused while the call is open.",
  },
  accept: {
    label: "Accept pledge",
    helper: "Turn the locked collateral into the active secured pledge.",
  },
  release: {
    label: "Release collateral",
    helper: "Close the pledge after exposure normalizes.",
  },
  seize: {
    label: "Seize collateral",
    helper: "Close the pledge through seizure after default.",
  },
  default: {
    label: "Run default closeout",
    helper: "Prove the downside path after the cure window fails.",
  },
};

const scenarioCopy: Array<{ value: WorkflowScenario; label: string; helper: string }> = [
  {
    value: "standard",
    label: "Standard",
    helper: "Clean margin call with one best-fit Treasury position.",
  },
  {
    value: "default-risk",
    label: "Default Risk",
    helper: "Same workflow, staged for the seizure path.",
  },
  {
    value: "undercovered",
    label: "Fallback",
    helper: "Shows rejected collateral before selecting the fallback asset.",
  },
];

export function WorkflowControls({
  actions,
  activeParty,
  stage,
}: {
  actions: WorkflowAction[];
  activeParty: PartyRole;
  stage: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submittingAction, setSubmittingAction] = useState<WorkflowAction | "reset" | null>(null);
  const [scenario, setScenario] = useState<WorkflowScenario>("standard");
  const [accessKey, setAccessKey] = useState("");
  const [needsAccessKey, setNeedsAccessKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canChooseScenario = actions.includes("bootstrap");
  const hasStarted = stage !== "call-open" || !canChooseScenario;

  async function establishSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/demo/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessKey }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.message ?? "Could not open demo session.");
      return;
    }

    setNeedsAccessKey(false);
    setAccessKey("");
    router.refresh();
  }

  async function resetDemo() {
    setSubmittingAction("reset");
    setError(null);

    const response = await fetch("/api/demo/reset", { method: "POST" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      if (payload?.requiresSession) setNeedsAccessKey(true);
      setError(payload?.message ?? "Could not reset the demo session.");
      setSubmittingAction(null);
      return;
    }

    startTransition(() => {
      router.replace(`/?party=${activeParty}`);
      router.refresh();
    });
    setSubmittingAction(null);
  }

  async function run(action: WorkflowAction) {
    setSubmittingAction(action);
    setError(null);

    try {
      const response = await fetch("/api/workflow/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, scenario: action === "bootstrap" ? scenario : undefined }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.requiresSession) setNeedsAccessKey(true);
        setError(payload?.message ?? "Canton command failed.");
        setSubmittingAction(null);
        return;
      }

      startTransition(() => {
        router.replace(`/?party=${activeParty}`);
        router.refresh();
      });
      setSubmittingAction(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Canton command failed.");
      setSubmittingAction(null);
    }
  }

  return (
    <div className="actions">
      {needsAccessKey ? (
        <form className="access-key-form" onSubmit={establishSession}>
          <label htmlFor="demo-access-key">Demo access key</label>
          <div>
            <input
              id="demo-access-key"
              name="demo-access-key"
              onChange={(event) => setAccessKey(event.target.value)}
              type="password"
              value={accessKey}
            />
            <button type="submit">Unlock</button>
          </div>
        </form>
      ) : null}

      {canChooseScenario ? (
        <div className="scenario-picker" aria-label="Workflow scenario">
          {scenarioCopy.map((item) => (
            <button
              className={item.value === scenario ? "scenario-option active" : "scenario-option"}
              key={item.value}
              onClick={() => setScenario(item.value)}
              type="button"
            >
              <strong>{item.label}</strong>
              <span>{item.helper}</span>
            </button>
          ))}
        </div>
      ) : null}

      {actions.length === 0 ? (
        <div className="action-empty">No command is currently available for this stage.</div>
      ) : (
        actions.map((action) => (
          <button className="action-button" disabled={pending || submittingAction !== null} key={action} onClick={() => run(action)}>
            <span>
              <strong>{submittingAction === action ? "Submitting to Canton..." : actionCopy[action].label}</strong>
              <span>{actionCopy[action].helper}</span>
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        ))
      )}

      {hasStarted ? (
        <button className="reset-button" disabled={pending || submittingAction !== null} onClick={resetDemo} type="button">
          <RotateCcw size={16} aria-hidden="true" />
          <span>{submittingAction === "reset" ? "Resetting..." : "Reset demo session"}</span>
        </button>
      ) : null}

      {error ? <div className="action-error">{error}</div> : null}
    </div>
  );
}
