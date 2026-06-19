import { z } from "zod";
import type {
  ActivePledge,
  AuditReceipt,
  CantonContract,
  CollateralRecommendation,
  CollateralOffer,
  LockedCollateral,
  MarginCall,
  PartyDirectory,
  PartyRole,
  PledgeCloseout,
  TreasuryPosition,
  WorkflowAction,
  WorkflowResult,
  WorkflowSnapshot,
  WorkflowStage,
} from "./types";

const partyRoleSchema = z.enum(["investor", "securedParty", "custodian", "auditor"]);
const actionSchema = z.enum(["bootstrap", "offer", "lock", "accept", "release", "seize", "default"]);

const templateIds = {
  TreasuryPosition: "#collateralops:CollateralOps:TreasuryPosition",
  MarginCall: "#collateralops:CollateralOps:MarginCall",
  CollateralOffer: "#collateralops:CollateralOps:CollateralOffer",
  LockedCollateral: "#collateralops:CollateralOps:LockedCollateral",
  ActivePledge: "#collateralops:CollateralOps:ActivePledge",
  PledgeCloseout: "#collateralops:CollateralOps:PledgeCloseout",
} as const;

const partyHints = {
  investor: "AtlasFund",
  securedParty: "NorthBank",
  custodian: "ClearVault",
  auditor: "RegSight",
} as const;

const globalKey = "__collateralops_canton_context__";

type GlobalWithContext = typeof globalThis & {
  [globalKey]?: {
    parties?: PartyDirectory;
    activeAtOffset?: number;
  };
};

export const partyQuerySchema = z.object({
  party: partyRoleSchema.default("investor"),
});

export const actionBodySchema = z.object({
  action: actionSchema,
});

export async function getSnapshot(activeParty: PartyRole): Promise<WorkflowSnapshot> {
  const client = cantonClient();
  const context = getContext();
  const parties = context.parties ?? partyHints;
  const bootstrapped = Boolean(context.activeAtOffset);
  const rawContracts = context.activeAtOffset
    ? await queryActiveContracts(client, parties[activeParty], context.activeAtOffset)
    : [];
  const contracts = filterVisibleContracts(rawContracts, activeParty, parties as PartyDirectory);

  const mapped = mapContracts(contracts, activeParty, parties as PartyDirectory);
  const stage = inferStage(mapped);
  const receipts = makeReceipts(mapped, stage);
  const recommendations = makeRecommendations(mapped.positions, mapped.calls);

  return {
    mode: "canton-json-api",
    activeParty,
    parties: parties as PartyDirectory,
    stage,
    contracts: [
      ...mapped.positions,
      ...mapped.calls,
      ...mapped.offers,
      ...mapped.locks,
      ...mapped.pledges,
      ...mapped.closeouts,
      ...receipts,
    ],
    receipts,
    recommendations,
    proof: {
      activeAtOffset: context.activeAtOffset ? String(context.activeAtOffset) : undefined,
      visibleContractCount: contracts.length,
      visibleTemplateIds: [...new Set(contracts.map((contract) => contract.templateId))],
      partyScopedQuery: `active-contracts filtered by ${parties[activeParty]}`,
    },
    visibility: {
      TreasuryPosition: mapped.positions.length > 0,
      MarginCall: mapped.calls.length > 0,
      CollateralOffer: mapped.offers.length > 0,
      LockedCollateral: mapped.locks.length > 0,
      ActivePledge: mapped.pledges.length > 0,
      PledgeCloseout: mapped.closeouts.length > 0,
      AuditReceipt: receipts.length > 0,
    },
    nextActions: bootstrapped ? nextActions(stage) : ["bootstrap"],
    updatedAt: new Date().toISOString(),
    updateId: context.activeAtOffset ? String(context.activeAtOffset) : undefined,
  };
}

export async function runWorkflowAction(action: WorkflowAction): Promise<WorkflowResult> {
  const client = cantonClient();
  const context = getContext();

  if (action === "bootstrap") {
    const parties = await allocateParties(client);
    const position = await submit(client, {
      userId: "ledger-api-user",
      commandId: commandId("create-position"),
      actAs: [parties.investor, parties.custodian],
      readAs: [parties.investor, parties.custodian, parties.auditor],
      commands: [
        {
          CreateCommand: {
            templateId: templateIds.TreasuryPosition,
            createArguments: {
              investor: parties.investor,
              custodian: parties.custodian,
              auditor: parties.auditor,
              cusip: "91282CJC6",
              issuer: "U.S. Treasury",
              faceValue: "5000000.0",
              marketValue: "4965000.0",
              haircutPct: "2.0",
              maturityDate: "2028-01-31",
              liquidityTier: "Tier 1",
              eligible: true,
              riskNotes: "On-the-run Treasury; high liquidity; custodian-verified.",
            },
          },
        },
      ],
    });

    const call = await submit(client, {
      userId: "ledger-api-user",
      commandId: commandId("create-call"),
      actAs: [parties.securedParty],
      readAs: [parties.securedParty, parties.investor, parties.auditor],
      commands: [
        {
          CreateCommand: {
            templateId: templateIds.MarginCall,
            createArguments: {
              securedParty: parties.securedParty,
              investor: parties.investor,
              auditor: parties.auditor,
              requiredValue: "4750000.0",
              currency: "USD",
              reason: "Intraday repo exposure breach after 2.8% UST price move",
              callType: "Repo margin call",
              counterpartyExposure: "11900000.0",
              minimumHaircutPct: "2.0",
              dueDate: "2026-06-17T18:00:00Z",
              status: "CallOpen",
            },
          },
        },
      ],
    });

    context.parties = parties;
    context.activeAtOffset = maxOffset(position, call);
    return ok(action, "call-open", context.activeAtOffset, "Bootstrapped parties, TreasuryPosition, and MarginCall on Canton.");
  }

  const parties = requireParties(context);
  const offset = requireOffset(context);

  if (action === "offer") {
    const investorContracts = filterVisibleContracts(await queryActiveContracts(client, parties.investor, offset), "investor", parties);
    const call = requireContract(investorContracts, "MarginCall");
    const mapped = mapContracts(investorContracts, "investor", parties);
    const recommendation = requireRecommendation(makeRecommendations(mapped.positions, mapped.calls));
    const position = investorContracts.find((contract) => contract.contractId === recommendation.positionId) ?? requireContract(investorContracts, "TreasuryPosition");
    const result = await submit(client, {
      userId: "ledger-api-user",
      commandId: commandId("offer"),
      actAs: [parties.investor],
      readAs: [parties.investor, parties.securedParty, parties.custodian, parties.auditor],
      commands: [
        {
          ExerciseCommand: {
            templateId: templateIds.MarginCall,
              contractId: call.contractId,
              choice: "OfferCollateral",
              choiceArgument: {
                positionCid: position.contractId,
                custodian: parties.custodian,
                pledgedValue: recommendation.pledgeAmount.toFixed(1),
                haircutPct: mapped.positions.find((item) => item.id === recommendation.positionId)?.haircutPct.toFixed(1) ?? "2.0",
              },
            },
        },
      ],
    });
    context.activeAtOffset = Number(result.completionOffset);
    return ok(action, "offer-posted", context.activeAtOffset, "Investor offered tokenized UST collateral on Canton.");
  }

  if (action === "lock") {
    const custodianContracts = filterVisibleContracts(await queryActiveContracts(client, parties.custodian, offset), "custodian", parties);
    const offer = requireContract(custodianContracts, "CollateralOffer");
    const result = await submitExercise(client, parties.custodian, templateIds.CollateralOffer, offer.contractId, "LockByCustodian", {});
    context.activeAtOffset = Number(result.completionOffset);
    return ok(action, "collateral-locked", context.activeAtOffset, "Custodian locked pledged collateral on Canton.");
  }

  if (action === "accept") {
    const securedContracts = filterVisibleContracts(await queryActiveContracts(client, parties.securedParty, offset), "securedParty", parties);
    const locked = requireContract(securedContracts, "LockedCollateral");
    const result = await submitExercise(client, parties.securedParty, templateIds.LockedCollateral, locked.contractId, "AcceptPledge", {});
    context.activeAtOffset = Number(result.completionOffset);
    return ok(action, "pledge-active", context.activeAtOffset, "Secured party accepted the active pledge on Canton.");
  }

  if (action === "release" || action === "seize" || action === "default") {
    const securedContracts = filterVisibleContracts(await queryActiveContracts(client, parties.securedParty, offset), "securedParty", parties);
    const pledge = requireContract(securedContracts, "ActivePledge");
    const closeoutAction = action === "release" ? "ReleaseCollateral" : "SeizeCollateral";
    const result = await submitExercise(
      client,
      parties.securedParty,
      templateIds.ActivePledge,
      pledge.contractId,
      closeoutAction,
      {},
    );
    context.activeAtOffset = Number(result.completionOffset);
    const stage = action === "release" ? "released" : "seized";
    return ok(
      action,
      stage,
      context.activeAtOffset,
      `Secured party ${action === "release" ? "released" : "seized"} collateral on Canton.`,
    );
  }

  throw new Error(`Unsupported action ${action}`);
}

export async function checkCantonHealth() {
  try {
    const client = cantonClient();
    const response = await fetch(`${client.baseUrl}/livez`, { cache: "no-store" });
    return {
      mode: "canton-json-api",
      healthy: response.ok,
      message: response.ok ? "Canton JSON Ledger API is reachable." : `Canton health check returned ${response.status}.`,
    };
  } catch (error) {
    return {
      mode: "canton-json-api",
      healthy: false,
      message: error instanceof Error ? error.message : "Canton health check failed.",
    };
  }
}

function cantonClient() {
  const baseUrl = process.env.CANTON_JSON_API_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("CANTON_JSON_API_URL is required. Start Canton with JSON API and set CANTON_JSON_API_URL=http://localhost:7575.");
  }
  return { baseUrl };
}

function getContext() {
  const target = globalThis as GlobalWithContext;
  target[globalKey] ??= {};
  return target[globalKey]!;
}

async function allocateParties(client: { baseUrl: string }): Promise<PartyDirectory> {
  const suffix = Date.now().toString(36);
  const entries = await Promise.all(
    Object.entries(partyHints).map(async ([role, hint]) => {
      const response = await postJson(client, "/v2/parties", { partyIdHint: `${hint}-${suffix}`, identityProviderId: "" });
      return [role, response.partyDetails.party] as const;
    }),
  );

  return Object.fromEntries(entries) as PartyDirectory;
}

async function submit(client: { baseUrl: string }, body: Record<string, unknown>) {
  return postJson(client, "/v2/commands/submit-and-wait", body) as Promise<{ completionOffset: number | string; updateId?: string }>;
}

async function submitExercise(
  client: { baseUrl: string },
  actor: string,
  templateId: string,
  contractId: string,
  choice: string,
  choiceArgument: Record<string, unknown>,
) {
  return submit(client, {
    userId: "ledger-api-user",
    commandId: commandId(choice),
    actAs: [actor],
    readAs: [actor],
    commands: [
      {
        ExerciseCommand: {
          templateId,
          contractId,
          choice,
          choiceArgument,
        },
      },
    ],
  });
}

async function queryActiveContracts(client: { baseUrl: string }, party: string, activeAtOffset: number): Promise<CantonContract[]> {
  const data = await postJson(client, "/v2/state/active-contracts", {
    eventFormat: {
      filtersByParty: {
        [party]: {
          cumulative: [
            {
              identifierFilter: {
                WildcardFilter: {
                  value: {
                    includeCreatedEventBlob: true,
                  },
                },
              },
            },
          ],
        },
      },
      filtersForAnyParty: {
        cumulative: [],
      },
      verbose: false,
    },
    verbose: false,
    activeAtOffset,
  });

  if (!Array.isArray(data)) return [];

  return data
    .map((entry) => entry?.contractEntry?.JsActiveContract?.createdEvent)
    .filter(Boolean)
    .map((event) => ({
      contractId: String(event.contractId),
      templateId: String(event.templateId),
      payload: event.createArgument ?? {},
    }));
}

async function postJson(client: { baseUrl: string }, path: string, body: Record<string, unknown>) {
  const response = await fetch(`${client.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${text}`);
  }

  return json;
}

function requireParties(context: { parties?: PartyDirectory }): PartyDirectory {
  if (!context.parties) {
    throw new Error("Run bootstrap first so parties exist on Canton.");
  }
  return context.parties;
}

function requireOffset(context: { activeAtOffset?: number }): number {
  if (!context.activeAtOffset) {
    throw new Error("Run bootstrap first so the app has a Canton ledger offset.");
  }
  return context.activeAtOffset;
}

function requireContract(contracts: CantonContract[], kind: keyof typeof templateIds): CantonContract {
  const contract = contracts.find((item) => item.templateId.includes(`:CollateralOps:${kind}`));
  if (!contract) {
    throw new Error(`No active ${kind} contract is visible to this party.`);
  }
  return contract;
}

function filterVisibleContracts(contracts: CantonContract[], role: PartyRole, parties: PartyDirectory): CantonContract[] {
  return contracts.filter((contract) => isCurrentContext(contract, parties) && isVisibleToRole(contract, role, parties));
}

function isCurrentContext(contract: CantonContract, parties: PartyDirectory): boolean {
  const payload = contract.payload;
  return [payload.investor, payload.securedParty, payload.custodian, payload.auditor]
    .filter(Boolean)
    .every((party) => Object.values(parties).includes(text(party)));
}

function isVisibleToRole(contract: CantonContract, role: PartyRole, parties: PartyDirectory): boolean {
  const payload = contract.payload;
  const party = parties[role];

  if (role === "investor") return text(payload.investor) === party;
  if (role === "securedParty") return text(payload.securedParty) === party;
  if (role === "custodian") {
    return text(payload.custodian) === party && !contract.templateId.includes(":CollateralOps:MarginCall");
  }
  if (role === "auditor") return text(payload.auditor) === party;
  return false;
}

function maxOffset(...responses: { completionOffset: number | string }[]): number {
  return Math.max(...responses.map((item) => Number(item.completionOffset)));
}

function ok(action: WorkflowAction, stage: WorkflowStage, offset: number | undefined, message: string): WorkflowResult {
  return {
    ok: true,
    mode: "canton-json-api",
    action,
    stage,
    updateId: offset ? String(offset) : undefined,
    message,
  };
}

function commandId(action: string) {
  return `collateralops-${action}-${Date.now()}`;
}

function mapContracts(contracts: CantonContract[], activeParty: PartyRole, parties: PartyDirectory) {
  const positions: TreasuryPosition[] = [];
  const calls: MarginCall[] = [];
  const offers: CollateralOffer[] = [];
  const locks: LockedCollateral[] = [];
  const pledges: ActivePledge[] = [];
  const closeouts: PledgeCloseout[] = [];

  for (const contract of contracts) {
    if (contract.templateId.includes(":CollateralOps:TreasuryPosition")) {
      positions.push({
        id: contract.contractId,
        kind: "TreasuryPosition",
        investor: text(contract.payload.investor),
        custodian: text(contract.payload.custodian),
        auditor: text(contract.payload.auditor),
        cusip: text(contract.payload.cusip),
        issuer: text(contract.payload.issuer),
        faceValue: decimal(contract.payload.faceValue),
        marketValue: decimal(contract.payload.marketValue),
        haircutPct: decimal(contract.payload.haircutPct),
        maturityDate: text(contract.payload.maturityDate),
        liquidityTier: text(contract.payload.liquidityTier),
        eligible: boolean(contract.payload.eligible),
        riskNotes: text(contract.payload.riskNotes),
        postHaircutValue: postHaircutValue(decimal(contract.payload.marketValue), decimal(contract.payload.haircutPct)),
        encumbrance: inferEncumbrance(contracts),
      });
    } else if (contract.templateId.includes(":CollateralOps:MarginCall")) {
      calls.push({
        id: contract.contractId,
        kind: "MarginCall",
        securedParty: text(contract.payload.securedParty),
        investor: text(contract.payload.investor),
        auditor: text(contract.payload.auditor),
        requiredValue: decimal(contract.payload.requiredValue),
        currency: "USD",
        reason: text(contract.payload.reason),
        callType: text(contract.payload.callType),
        counterpartyExposure: decimal(contract.payload.counterpartyExposure),
        minimumHaircutPct: decimal(contract.payload.minimumHaircutPct),
        dueDate: text(contract.payload.dueDate),
        status: "call-open",
      });
    } else if (contract.templateId.includes(":CollateralOps:CollateralOffer")) {
      offers.push({
        id: contract.contractId,
        kind: "CollateralOffer",
        callId: text(contract.payload.callId),
        positionId: text(contract.payload.positionCid),
        investor: text(contract.payload.investor),
        securedParty: text(contract.payload.securedParty),
        custodian: text(contract.payload.custodian),
        auditor: text(contract.payload.auditor),
        pledgedValue: decimal(contract.payload.pledgedValue),
        haircutPct: decimal(contract.payload.haircutPct),
        recommendationNote: text(contract.payload.recommendationNote),
      });
    } else if (contract.templateId.includes(":CollateralOps:LockedCollateral")) {
      locks.push({
        id: contract.contractId,
        kind: "LockedCollateral",
        callId: text(contract.payload.callId),
        positionId: text(contract.payload.positionCid),
        investor: text(contract.payload.investor),
        securedParty: text(contract.payload.securedParty),
        custodian: text(contract.payload.custodian),
        auditor: text(contract.payload.auditor),
        lockedValue: decimal(contract.payload.lockedValue),
        haircutPct: decimal(contract.payload.haircutPct),
        recommendationNote: text(contract.payload.recommendationNote),
        lockedAt: new Date().toISOString(),
      });
    } else if (contract.templateId.includes(":CollateralOps:ActivePledge")) {
      pledges.push({
        id: contract.contractId,
        kind: "ActivePledge",
        callId: "accepted",
        positionId: text(contract.payload.positionCid),
        investor: text(contract.payload.investor),
        securedParty: text(contract.payload.securedParty),
        custodian: text(contract.payload.custodian),
        auditor: text(contract.payload.auditor),
        pledgedValue: decimal(contract.payload.pledgedValue),
        haircutPct: decimal(contract.payload.haircutPct),
        recommendationNote: text(contract.payload.recommendationNote),
        acceptedAt: new Date().toISOString(),
      });
    } else if (contract.templateId.includes(":CollateralOps:PledgeCloseout")) {
      closeouts.push({
        id: contract.contractId,
        kind: "PledgeCloseout",
        positionId: text(contract.payload.positionCid),
        investor: text(contract.payload.investor),
        securedParty: text(contract.payload.securedParty),
        custodian: text(contract.payload.custodian),
        auditor: text(contract.payload.auditor),
        finalStatus: enumText(contract.payload.finalStatus) === "Seized" ? "seized" : "released",
        summary: text(contract.payload.summary),
        recommendationNote: text(contract.payload.recommendationNote),
      });
    }
  }

  return { activeParty, parties, positions, calls, offers, locks, pledges, closeouts };
}

function inferStage(mapped: ReturnType<typeof mapContracts>): WorkflowStage {
  if (mapped.closeouts.some((closeout) => closeout.finalStatus === "seized")) return "seized";
  if (mapped.closeouts.some((closeout) => closeout.finalStatus === "released")) return "released";
  if (mapped.pledges.length > 0) return "pledge-active";
  if (mapped.locks.length > 0) return "collateral-locked";
  if (mapped.offers.length > 0) return "offer-posted";
  if (mapped.calls.length > 0) return "call-open";
  return "call-open";
}

function inferEncumbrance(contracts: CantonContract[]): TreasuryPosition["encumbrance"] {
  const closeout = contracts.find((contract) => contract.templateId.includes(":CollateralOps:PledgeCloseout"));
  if (closeout) return enumText(closeout.payload.finalStatus) === "Seized" ? "seized" : "released";
  if (contracts.some((contract) => contract.templateId.includes(":CollateralOps:ActivePledge"))) return "pledged";
  if (contracts.some((contract) => contract.templateId.includes(":CollateralOps:LockedCollateral"))) return "locked";
  if (contracts.some((contract) => contract.templateId.includes(":CollateralOps:CollateralOffer"))) return "offered";
  return "free";
}

function nextActions(stage: WorkflowStage): WorkflowAction[] {
  if (stage === "call-open") return ["offer"];
  if (stage === "offer-posted") return ["lock"];
  if (stage === "collateral-locked") return ["accept"];
  if (stage === "pledge-active") return ["release", "default"];
  return ["bootstrap"];
}

function makeReceipts(mapped: ReturnType<typeof mapContracts>, stage: WorkflowStage): AuditReceipt[] {
  if (mapped.activeParty === "custodian") return [];

  const timestamp = new Date().toISOString();
  const receipts: AuditReceipt[] = [];
  if (mapped.calls.length > 0) receipts.push(receipt("bootstrap", "securedParty", timestamp, "NorthBank opened a Canton margin call."));
  if (mapped.offers.length > 0) receipts.push(receipt("offer", "investor", timestamp, "AtlasFund offered tokenized UST collateral."));
  if (mapped.locks.length > 0) receipts.push(receipt("lock", "custodian", timestamp, "ClearVault locked the pledged position."));
  if (mapped.pledges.length > 0 || stage === "pledge-active") receipts.push(receipt("accept", "securedParty", timestamp, "NorthBank accepted the active pledge."));
  if (stage === "released") receipts.push(receipt("release", "securedParty", timestamp, "NorthBank released the collateral on Canton."));
  if (stage === "seized") receipts.push(receipt("default", "securedParty", timestamp, "NorthBank seized the collateral on Canton."));
  return receipts;
}

function receipt(action: WorkflowAction, actor: PartyRole, timestamp: string, summary: string): AuditReceipt {
  return {
    id: `receipt-${action}`,
    kind: "AuditReceipt",
    callId: "call",
    visibleTo: ["investor", "securedParty", "auditor"],
    action,
    actor,
    timestamp,
    summary,
  };
}

function text(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function decimal(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function boolean(value: unknown) {
  return value === true || value === "true";
}

function enumText(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "tag" in value && typeof value.tag === "string") return value.tag;
  return text(value);
}

function postHaircutValue(marketValue: number, haircutPct: number) {
  return marketValue * (1 - haircutPct / 100);
}

export function makeRecommendations(positions: TreasuryPosition[], calls: MarginCall[]): CollateralRecommendation[] {
  const call = calls[0];
  if (!call) return [];

  return positions
    .map((position) => {
      const warnings = [];
      if (!position.eligible) warnings.push("Position is not eligible for this call.");
      if (position.haircutPct < call.minimumHaircutPct) warnings.push("Haircut is below secured-party minimum.");
      if (position.postHaircutValue < call.requiredValue) warnings.push("Post-haircut value is below required collateral.");

      return {
        positionId: position.id,
        cusip: position.cusip,
        pledgeAmount: Math.max(call.requiredValue, Math.min(position.marketValue, position.postHaircutValue)),
        postHaircutValue: position.postHaircutValue,
        coverageRatio: position.postHaircutValue / call.requiredValue,
        rank: 0,
        rationale: `${position.liquidityTier} ${position.issuer} collateral covers ${Math.round((position.postHaircutValue / call.requiredValue) * 100)}% of the requirement after haircut.`,
        warnings,
      };
    })
    .filter((recommendation) => recommendation.warnings.length === 0)
    .sort((left, right) => right.coverageRatio - left.coverageRatio)
    .map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));
}

function requireRecommendation(recommendations: CollateralRecommendation[]) {
  const recommendation = recommendations[0];
  if (!recommendation) {
    throw new Error("No eligible collateral recommendation is visible to the investor.");
  }
  return recommendation;
}
