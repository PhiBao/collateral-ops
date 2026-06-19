export type PartyRole = "investor" | "securedParty" | "custodian" | "auditor";

export type LedgerMode = "canton-json-api";

export type WorkflowStage =
  | "call-open"
  | "offer-posted"
  | "collateral-locked"
  | "pledge-active"
  | "released"
  | "seized";

export type ContractKind =
  | "TreasuryPosition"
  | "MarginCall"
  | "CollateralOffer"
  | "LockedCollateral"
  | "ActivePledge"
  | "PledgeCloseout"
  | "AuditReceipt";

export interface PartyDirectory {
  investor: string;
  securedParty: string;
  custodian: string;
  auditor: string;
}

export interface TreasuryPosition {
  id: string;
  kind: "TreasuryPosition";
  investor: string;
  custodian: string;
  auditor: string;
  cusip: string;
  issuer: string;
  faceValue: number;
  marketValue: number;
  haircutPct: number;
  maturityDate: string;
  liquidityTier: string;
  eligible: boolean;
  riskNotes: string;
  postHaircutValue: number;
  encumbrance: "free" | "offered" | "locked" | "pledged" | "released" | "seized";
}

export interface MarginCall {
  id: string;
  kind: "MarginCall";
  securedParty: string;
  investor: string;
  auditor: string;
  requiredValue: number;
  currency: "USD";
  reason: string;
  callType: string;
  counterpartyExposure: number;
  minimumHaircutPct: number;
  dueDate: string;
  status: WorkflowStage;
}

export interface CollateralOffer {
  id: string;
  kind: "CollateralOffer";
  callId: string;
  positionId: string;
  investor: string;
  securedParty: string;
  custodian: string;
  auditor: string;
  pledgedValue: number;
  haircutPct: number;
  recommendationNote: string;
}

export interface LockedCollateral {
  id: string;
  kind: "LockedCollateral";
  callId: string;
  positionId: string;
  investor: string;
  securedParty: string;
  custodian: string;
  auditor: string;
  lockedValue: number;
  haircutPct: number;
  recommendationNote: string;
  lockedAt: string;
}

export interface ActivePledge {
  id: string;
  kind: "ActivePledge";
  callId: string;
  positionId: string;
  investor: string;
  securedParty: string;
  custodian: string;
  auditor: string;
  pledgedValue: number;
  haircutPct: number;
  recommendationNote: string;
  acceptedAt: string;
  terminalState?: "released" | "seized";
}

export interface AuditReceipt {
  id: string;
  kind: "AuditReceipt";
  callId: string;
  visibleTo: PartyRole[];
  action: string;
  actor: PartyRole;
  timestamp: string;
  summary: string;
  updateId?: string;
}

export interface PledgeCloseout {
  id: string;
  kind: "PledgeCloseout";
  securedParty: string;
  investor: string;
  custodian: string;
  auditor: string;
  positionId: string;
  finalStatus: "released" | "seized";
  summary: string;
  recommendationNote: string;
}

export type WorkflowContract =
  | TreasuryPosition
  | MarginCall
  | CollateralOffer
  | LockedCollateral
  | ActivePledge
  | PledgeCloseout
  | AuditReceipt;

export interface WorkflowSnapshot {
  mode: LedgerMode;
  activeParty: PartyRole;
  parties: PartyDirectory;
  stage: WorkflowStage;
  contracts: WorkflowContract[];
  receipts: AuditReceipt[];
  recommendations: CollateralRecommendation[];
  proof: CantonProof;
  visibility: Record<ContractKind, boolean>;
  nextActions: WorkflowAction[];
  updatedAt: string;
  updateId?: string;
}

export interface CollateralRecommendation {
  positionId: string;
  cusip: string;
  pledgeAmount: number;
  postHaircutValue: number;
  coverageRatio: number;
  rank: number;
  rationale: string;
  warnings: string[];
}

export interface CantonProof {
  activeAtOffset?: string;
  visibleContractCount: number;
  visibleTemplateIds: string[];
  partyScopedQuery: string;
}

export type WorkflowAction = "bootstrap" | "offer" | "lock" | "accept" | "release" | "seize" | "default";

export interface WorkflowResult {
  ok: true;
  mode: LedgerMode;
  action: WorkflowAction;
  stage: WorkflowStage;
  updateId?: string;
  message: string;
}

export interface WorkflowError {
  ok: false;
  code: string;
  message: string;
}

export interface CantonContract {
  contractId: string;
  templateId: string;
  payload: Record<string, unknown>;
}
