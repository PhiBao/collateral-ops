export type PartyRole = "investor" | "securedParty" | "custodian" | "auditor";

export type LedgerMode = "canton-json-api";

export type WorkflowScenario = "standard" | "default-risk" | "undercovered" | "weekend-stress";

export type WorkflowStage =
  | "call-open"
  | "offer-posted"
  | "collateral-locked"
  | "pledge-active"
  | "settled"
  | "released"
  | "seized";

export type ContractKind =
  | "TreasuryPosition"
  | "TokenizedCash"
  | "CashTransfer"
  | "MarginCall"
  | "ExposureTerms"
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

export interface WorkflowSessionState {
  parties?: PartyDirectory;
  activeAtOffset?: number;
  scenario?: WorkflowScenario;
  lastAction?: WorkflowAction;
  bootstrapTimestamp?: number;
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
  encumbrance: "free" | "offered" | "locked" | "pledged" | "settled" | "released" | "seized";
}

export interface TokenizedCash {
  id: string;
  kind: "TokenizedCash";
  issuer: string;
  holder: string;
  amount: number;
  currency: string;
  eligible: boolean;
}

export interface CashTransfer {
  id: string;
  kind: "CashTransfer";
  from: string;
  to: string;
  amount: number;
  currency: string;
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

export interface ExposureTerms {
  id: string;
  kind: "ExposureTerms";
  securedParty: string;
  investor: string;
  valuationSource: string;
  disputeWindowHours: number;
  closeoutThresholdPct: number;
  sensitiveNote: string;
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
  terminalStatus?: "active" | "settled" | "released" | "seized";
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
  | TokenizedCash
  | CashTransfer
  | MarginCall
  | ExposureTerms
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
  scenario: WorkflowScenario;
  sessionScoped: boolean;
  contracts: WorkflowContract[];
  receipts: AuditReceipt[];
  recommendations: CollateralRecommendation[];
  proof: CantonProof;
  visibility: Record<ContractKind, boolean>;
  nextActions: WorkflowAction[];
  updatedAt: string;
  updateId?: string;
  settlementSeconds?: number;
}

export interface CollateralRecommendation {
  positionId: string;
  cusip: string;
  pledgeAmount: number;
  postHaircutValue: number;
  coverageRatio: number;
  surplusValue: number;
  rank: number;
  selectable: boolean;
  selectionReason: string;
  rationale: string;
  warnings: string[];
  rejectionReasons: string[];
}

export interface PartyVisibilityProof {
  role: PartyRole;
  party: string;
  visibleContractCount: number;
  visibleTemplateIds: string[];
  seesPrivateTerms: boolean;
  seesCashLeg: boolean;
  hiddenSensitiveTemplates: string[];
}

export interface CantonProof {
  activeAtOffset?: string;
  visibleContractCount: number;
  visibleTemplateIds: string[];
  partyScopedQuery: string;
  partyVisibility: PartyVisibilityProof[];
  lastAction?: WorkflowAction;
  scenario: WorkflowScenario;
}

export type WorkflowAction = "bootstrap" | "offer" | "lock" | "accept" | "settle" | "release" | "seize" | "default";

export interface WorkflowResult {
  ok: true;
  mode: LedgerMode;
  action: WorkflowAction;
  stage: WorkflowStage;
  scenario: WorkflowScenario;
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
  witnessParties?: string[];
  signatories?: string[];
  observers?: string[];
}
