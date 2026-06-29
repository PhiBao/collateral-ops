import { shortTime, usd } from "./format";
import type {
  ContractKind,
  MarginCall,
  PartyRole,
  TreasuryPosition,
  WorkflowAction,
  WorkflowSnapshot,
  WorkflowStage,
} from "./types";

export const roleOrder: PartyRole[] = ["investor", "securedParty", "custodian", "auditor"];

export const roleCopy: Record<PartyRole, { name: string; shortName: string; description: string }> = {
  investor: {
    name: "Investor",
    shortName: "AtlasFund",
    description: "Chooses eligible collateral and starts the response.",
  },
  securedParty: {
    name: "Secured Party",
    shortName: "NorthBank",
    description: "Reviews the locked pledge and resolves the exposure.",
  },
  custodian: {
    name: "Custodian",
    shortName: "ClearVault",
    description: "Locks the asset and prevents reuse during the pledge.",
  },
  auditor: {
    name: "Auditor",
    shortName: "RegSight",
    description: "Sees restricted evidence without global state exposure.",
  },
};

export const visibilityLabels: Record<ContractKind, string> = {
  TreasuryPosition: "Treasury position",
  MarginCall: "Margin call",
  ExposureTerms: "Private exposure terms",
  CollateralOffer: "Collateral offer",
  LockedCollateral: "Custody lock",
  ActivePledge: "Active pledge",
  PledgeCloseout: "Closeout record",
  AuditReceipt: "Audit receipt",
};

const stageCopy: Record<
  WorkflowStage,
  {
    label: string;
    headline: string;
    summary: string;
    next: string;
    nextActor: PartyRole;
    outcome: string;
  }
> = {
  "call-open": {
    label: "Margin call open",
    headline: "Resolve this margin call with eligible Treasury collateral.",
    summary: "NorthBank raised a private repo margin requirement against AtlasFund after an intraday UST move.",
    next: "Review the recommended Treasury position and submit the collateral offer.",
    nextActor: "investor",
    outcome: "Offer collateral",
  },
  "offer-posted": {
    label: "Collateral offered",
    headline: "The collateral offer is waiting for custody lock.",
    summary: "AtlasFund selected the Treasury position and offered it into the pledge workflow.",
    next: "ClearVault should lock the asset so it cannot be reused elsewhere.",
    nextActor: "custodian",
    outcome: "Lock asset",
  },
  "collateral-locked": {
    label: "Custody lock active",
    headline: "The Treasury position is locked and ready for acceptance.",
    summary: "ClearVault marked the Treasury position as encumbered on Canton.",
    next: "NorthBank should accept the locked collateral as an active pledge.",
    nextActor: "securedParty",
    outcome: "Accept pledge",
  },
  "pledge-active": {
    label: "Pledge active",
    headline: "The pledge is active with private evidence for each party.",
    summary: "The collateral pledge is live and visible only to parties allowed by the Daml model.",
    next: "Resolve the exposure by release, or prove the default closeout path.",
    nextActor: "securedParty",
    outcome: "Resolve pledge",
  },
  released: {
    label: "Collateral released",
    headline: "The exposure is resolved and collateral is released.",
    summary: "The pledge was closed and the Treasury position is no longer encumbered.",
    next: "Start a fresh Canton workflow to run the sequence again.",
    nextActor: "investor",
    outcome: "Workflow complete",
  },
  seized: {
    label: "Collateral seized",
    headline: "The default path closed with collateral seizure.",
    summary: "The pledge was closed by seizure after the secured party exercised its closeout right.",
    next: "Start a fresh Canton workflow to run another scenario.",
    nextActor: "securedParty",
    outcome: "Closeout complete",
  },
};

const actionIntent: Record<WorkflowAction, string> = {
  bootstrap: "Start workflow",
  offer: "Offer collateral",
  lock: "Lock asset",
  accept: "Accept pledge",
  release: "Release collateral",
  seize: "Seize collateral",
  default: "Run default closeout",
};

export interface WorkflowViewModel {
  activeParty: PartyRole;
  activeRoleName: string;
  activePartyId: string;
  stageLabel: string;
  headline: string;
  summary: string;
  nextActionSummary: string;
  nextActor: PartyRole;
  nextActorName: string;
  primaryIntent: string;
  hasLiveWorkflow: boolean;
  isFreshStart: boolean;
  requiredValue: string;
  exposureValue: string;
  dueAt: string;
  recommendedCusip: string;
  recommendedCoverage: string;
  recommendedPledge: string;
  collateralState: string;
  proofStatus: string;
  scenarioLabel: string;
}

export function buildWorkflowViewModel(snapshot: WorkflowSnapshot): WorkflowViewModel {
  const hasLiveWorkflow = snapshot.contracts.length > 0 || snapshot.receipts.length > 0;
  const isFreshStart = !hasLiveWorkflow && snapshot.nextActions.length === 1 && snapshot.nextActions[0] === "bootstrap";
  const stage = isFreshStart
    ? {
        label: "Ready to start",
        headline: "Start a private collateral workflow on Canton.",
        summary: "No active CollateralOps workflow is loaded in this app process yet.",
        next: "Create the parties, Treasury position, and first margin call.",
        nextActor: "investor" as PartyRole,
        outcome: "Start workflow",
      }
    : stageCopy[snapshot.stage];
  const call = firstContract(snapshot, "MarginCall");
  const position = firstContract(snapshot, "TreasuryPosition");
  const recommendation = snapshot.recommendations.find((item) => item.selectable) ?? snapshot.recommendations[0];
  const primaryAction = snapshot.nextActions[0];

  return {
    activeParty: snapshot.activeParty,
    activeRoleName: roleCopy[snapshot.activeParty].name,
    activePartyId: snapshot.parties[snapshot.activeParty],
    stageLabel: stage.label,
    headline: stage.headline,
    summary: stage.summary,
    nextActionSummary: stage.next,
    nextActor: stage.nextActor,
    nextActorName: roleCopy[stage.nextActor].name,
    primaryIntent: primaryAction ? actionIntent[primaryAction] : stage.outcome,
    hasLiveWorkflow,
    isFreshStart,
    requiredValue: call ? usd(call.requiredValue) : "Awaiting call",
    exposureValue: call ? usd(call.counterpartyExposure) : "Awaiting exposure",
    dueAt: call ? shortTime(call.dueDate) : "Not scheduled",
    recommendedCusip: recommendation?.cusip ?? position?.cusip ?? "No visible asset",
    recommendedCoverage: recommendation ? `${Math.round(recommendation.coverageRatio * 100)}%` : "Not visible",
    recommendedPledge: recommendation ? usd(recommendation.pledgeAmount) : "Not visible",
    collateralState: position?.encumbrance ?? "not visible",
    proofStatus: snapshot.proof.activeAtOffset ? `Offset ${snapshot.proof.activeAtOffset}` : "Not bootstrapped",
    scenarioLabel: scenarioLabel(snapshot.scenario),
  };
}

function scenarioLabel(scenario: WorkflowSnapshot["scenario"]) {
  if (scenario === "default-risk") return "Default-risk path";
  if (scenario === "undercovered") return "Fallback collateral path";
  return "Standard margin call";
}

export function workflowSteps(stage: WorkflowStage, started: boolean) {
  const steps = [
    { key: "call-open", label: "Call opened", actor: "Secured Party" },
    { key: "offer-posted", label: "Collateral offered", actor: "Investor" },
    { key: "collateral-locked", label: "Asset locked", actor: "Custodian" },
    { key: "pledge-active", label: "Pledge accepted", actor: "Secured Party" },
    { key: "released", label: "Released", actor: "Secured Party" },
    { key: "seized", label: "Default closeout", actor: "Secured Party" },
  ] as const;
  const index = steps.findIndex((step) => step.key === stage);
  const activeIndex = started ? Math.max(0, index === -1 ? 0 : index) : -1;

  return steps.map((step, stepIndex) => ({
    ...step,
    state: stepIndex < activeIndex ? "complete" : stepIndex === activeIndex ? "current" : "pending",
  }));
}

function firstContract<T extends "MarginCall" | "TreasuryPosition">(
  snapshot: WorkflowSnapshot,
  kind: T,
): T extends "MarginCall" ? MarginCall | undefined : TreasuryPosition | undefined {
  return snapshot.contracts.find((contract) => contract.kind === kind) as
    | (T extends "MarginCall" ? MarginCall : TreasuryPosition)
    | undefined;
}
