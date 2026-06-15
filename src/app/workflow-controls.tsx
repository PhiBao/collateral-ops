"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { PartyRole, WorkflowAction } from "@/lib/types";

const actionCopy: Record<WorkflowAction, { label: string; helper: string }> = {
  bootstrap: {
    label: "Start Fresh Canton Workflow",
    helper: "Allocates parties and creates the initial TreasuryPosition + MarginCall contracts.",
  },
  offer: {
    label: "Investor Offers Collateral",
    helper: "Exercises OfferCollateral on the visible TreasuryPosition and MarginCall.",
  },
  lock: {
    label: "Custodian Locks Asset",
    helper: "Exercises LockByCustodian so the pledged UST cannot be reused.",
  },
  accept: {
    label: "Secured Party Accepts Pledge",
    helper: "Exercises AcceptPledge and creates the active pledge contract.",
  },
  release: {
    label: "Release Collateral",
    helper: "Closes the active pledge and marks the Treasury position released.",
  },
  seize: {
    label: "Seize Collateral",
    helper: "Closes the active pledge as seized after default.",
  },
};

export function WorkflowControls({
  actions,
  activeParty,
}: {
  actions: WorkflowAction[];
  activeParty: PartyRole;
  stage: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function run(action: WorkflowAction) {
    const response = await fetch("/api/workflow/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      window.alert(payload?.message ?? "Canton command failed.");
      return;
    }

    startTransition(() => {
      router.replace(`/?party=${activeParty}`);
      router.refresh();
    });
  }

  return (
    <div className="actions">
      {actions.length === 0 ? (
        <div className="action-empty">No command is currently available for this stage.</div>
      ) : (
        actions.map((action) => (
          <button disabled={pending} key={action} onClick={() => run(action)}>
            <strong>{pending ? "Submitting to Canton..." : actionCopy[action].label}</strong>
            <span>{actionCopy[action].helper}</span>
          </button>
        ))
      )}
    </div>
  );
}
