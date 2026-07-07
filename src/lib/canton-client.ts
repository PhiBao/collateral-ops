import { z } from "zod";
import type {
  ActivePledge,
  AuditReceipt,
  CantonContract,
  CashTransfer,
  CollateralRecommendation,
  CollateralOffer,
  ExposureTerms,
  LockedCollateral,
  MarginCall,
  PartyDirectory,
  PartyRole,
  PartyVisibilityProof,
  PledgeCloseout,
  TokenizedCash,
  TreasuryPosition,
  WorkflowAction,
  WorkflowResult,
  WorkflowScenario,
  WorkflowSessionState,
  WorkflowSnapshot,
  WorkflowStage,
} from "./types";

const roleOrder: PartyRole[] = ["investor", "securedParty", "custodian", "auditor"];
const partyRoleSchema = z.enum(["investor", "securedParty", "custodian", "auditor"]);
const workflowScenarioSchema = z.enum(["standard", "default-risk", "undercovered", "weekend-stress"]);
const actionSchema = z.enum(["bootstrap", "offer", "lock", "accept", "settle", "release", "seize", "default"]);

const templateIds = {
  TreasuryPosition: "#collateralops:CollateralOps:TreasuryPosition",
  TokenizedCash: "#collateralops:CollateralOps:TokenizedCash",
  CashTransfer: "#collateralops:CollateralOps:CashTransfer",
  MarginCall: "#collateralops:CollateralOps:MarginCall",
  ExposureTerms: "#collateralops:CollateralOps:ExposureTerms",
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

interface WorkflowContext extends WorkflowSessionState {
  parties?: PartyDirectory;
  activeAtOffset?: number;
  scenario?: WorkflowScenario;
  lastAction?: WorkflowAction;
  mutationTimestamps?: number[];
  bootstrapTimestamp?: number;
}

type PartyScopedContracts = Record<PartyRole, CantonContract[]>;

type GlobalWithContext = typeof globalThis & {
  [globalKey]?: {
    sessions: Record<string, WorkflowContext>;
  };
};

interface WorkflowActionOptions {
  sessionId?: string;
  scenario?: WorkflowScenario;
  persistedContext?: WorkflowSessionState;
}

interface TreasurySeed {
  cusip: string;
  issuer: string;
  faceValue: number;
  marketValue: number;
  haircutPct: number;
  maturityDate: string;
  liquidityTier: string;
  eligible: boolean;
  riskNotes: string;
}

interface CashSeed {
  amount: number;
  currency: string;
  eligible: boolean;
}

interface ScenarioConfig {
  call: {
    requiredValue: number;
    reason: string;
    callType: string;
    counterpartyExposure: number;
    minimumHaircutPct: number;
    dueDate: string;
  };
  terms: {
    valuationSource: string;
    disputeWindowHours: number;
    closeoutThresholdPct: number;
    sensitiveNote: string;
  };
  positions: TreasurySeed[];
  cash?: CashSeed;
}

const scenarioConfigs: Record<WorkflowScenario, ScenarioConfig> = {
  standard: {
    call: {
      requiredValue: 4_750_000,
      reason: "Intraday repo exposure breach after 2.8% UST price move",
      callType: "Repo margin call",
      counterpartyExposure: 11_900_000,
      minimumHaircutPct: 2,
      dueDate: "2026-06-29T18:00:00Z",
    },
    terms: {
      valuationSource: "NorthBank internal repo book + custodian marks",
      disputeWindowHours: 4,
      closeoutThresholdPct: 102,
      sensitiveNote: "Counterparty watchlist flag remains private to AtlasFund and NorthBank.",
    },
    positions: [
      {
        cusip: "91282CJC6",
        issuer: "U.S. Treasury",
        faceValue: 5_000_000,
        marketValue: 4_965_000,
        haircutPct: 2,
        maturityDate: "2028-01-31",
        liquidityTier: "Tier 1",
        eligible: true,
        riskNotes: "On-the-run Treasury; high liquidity; custodian-verified.",
      },
      {
        cusip: "91282CKQ3",
        issuer: "U.S. Treasury",
        faceValue: 6_000_000,
        marketValue: 5_945_000,
        haircutPct: 2.5,
        maturityDate: "2029-05-15",
        liquidityTier: "Tier 1",
        eligible: true,
        riskNotes: "Larger position available but creates avoidable over-pledge.",
      },
      {
        cusip: "3130AQF42",
        issuer: "Agency note",
        faceValue: 5_000_000,
        marketValue: 4_980_000,
        haircutPct: 3,
        maturityDate: "2027-09-30",
        liquidityTier: "Tier 2",
        eligible: false,
        riskNotes: "Not eligible for this secured-party Treasury-only call.",
      },
    ],
  },
  "default-risk": {
    call: {
      requiredValue: 4_750_000,
      reason: "Repo exposure breach with cure-window default risk",
      callType: "Repo margin call",
      counterpartyExposure: 12_600_000,
      minimumHaircutPct: 2,
      dueDate: "2026-06-29T17:00:00Z",
    },
    terms: {
      valuationSource: "NorthBank stressed marks and cure-window monitor",
      disputeWindowHours: 2,
      closeoutThresholdPct: 104,
      sensitiveNote: "Default cure clock is visible only to the investor and secured party.",
    },
    positions: [
      {
        cusip: "91282CJC6",
        issuer: "U.S. Treasury",
        faceValue: 5_000_000,
        marketValue: 4_965_000,
        haircutPct: 2,
        maturityDate: "2028-01-31",
        liquidityTier: "Tier 1",
        eligible: true,
        riskNotes: "Close to requirement; preferred unless the secured party demands a stress buffer.",
      },
      {
        cusip: "91282CKQ3",
        issuer: "U.S. Treasury",
        faceValue: 5_500_000,
        marketValue: 5_430_000,
        haircutPct: 2,
        maturityDate: "2029-05-15",
        liquidityTier: "Tier 1",
        eligible: true,
        riskNotes: "Higher cushion for default-risk branch.",
      },
    ],
  },
  undercovered: {
    call: {
      requiredValue: 4_750_000,
      reason: "Intraday call where first-choice collateral fails coverage checks",
      callType: "Repo margin call",
      counterpartyExposure: 11_900_000,
      minimumHaircutPct: 2,
      dueDate: "2026-06-29T18:00:00Z",
    },
    terms: {
      valuationSource: "NorthBank margin engine with custodian liquidity flags",
      disputeWindowHours: 3,
      closeoutThresholdPct: 103,
      sensitiveNote: "Fallback collateral is disclosed only after rejected positions are evaluated.",
    },
    positions: [
      {
        cusip: "91282CJA0",
        issuer: "U.S. Treasury",
        faceValue: 4_200_000,
        marketValue: 4_080_000,
        haircutPct: 2,
        maturityDate: "2027-12-31",
        liquidityTier: "Tier 1",
        eligible: true,
        riskNotes: "Operationally preferred but below the required post-haircut value.",
      },
      {
        cusip: "91282CJB8",
        issuer: "U.S. Treasury",
        faceValue: 5_000_000,
        marketValue: 4_920_000,
        haircutPct: 1,
        maturityDate: "2028-01-15",
        liquidityTier: "Tier 1",
        eligible: true,
        riskNotes: "Liquid but below NorthBank's minimum haircut policy.",
      },
      {
        cusip: "3130AQF42",
        issuer: "Agency note",
        faceValue: 5_200_000,
        marketValue: 5_050_000,
        haircutPct: 3,
        maturityDate: "2027-09-30",
        liquidityTier: "Tier 2",
        eligible: false,
        riskNotes: "Rejected because this call accepts UST collateral only.",
      },
      {
        cusip: "91282CKQ3",
        issuer: "U.S. Treasury",
        faceValue: 5_100_000,
        marketValue: 4_990_000,
        haircutPct: 2,
        maturityDate: "2029-05-15",
        liquidityTier: "Tier 1",
        eligible: true,
        riskNotes: "Fallback position that satisfies the secured-party rule with minimal surplus.",
      },
    ],
  },
  "weekend-stress": {
    call: {
      requiredValue: 5_200_000,
      reason: "Saturday 02:30 UTC margin call — exposure breach over the weekend",
      callType: "Weekend repo margin call",
      counterpartyExposure: 13_100_000,
      minimumHaircutPct: 2,
      dueDate: "2026-07-04T02:30:00Z",
    },
    terms: {
      valuationSource: "NorthBank weekend exposure monitor with real-time custodian marks",
      disputeWindowHours: 1,
      closeoutThresholdPct: 105,
      sensitiveNote: "Weekend accelerated resolution — pre-market Monday settlement required. Private to AtlasFund and NorthBank.",
    },
    positions: [
      {
        cusip: "91282CJC6",
        issuer: "U.S. Treasury",
        faceValue: 5_300_000,
        marketValue: 5_260_000,
        haircutPct: 2,
        maturityDate: "2028-01-31",
        liquidityTier: "Tier 1",
        eligible: true,
        riskNotes: "Primary UST position available for immediate weekend settlement.",
      },
      {
        cusip: "91282CKQ3",
        issuer: "U.S. Treasury",
        faceValue: 6_000_000,
        marketValue: 5_945_000,
        haircutPct: 2.5,
        maturityDate: "2029-05-15",
        liquidityTier: "Tier 1",
        eligible: true,
        riskNotes: "Larger buffer position for stress scenarios.",
      },
    ],
    cash: {
      amount: 6_000_000,
      currency: "USD",
      eligible: true,
    },
  },
};

export const partyQuerySchema = z.object({
  party: partyRoleSchema.default("investor"),
});

export const actionBodySchema = z.object({
  action: actionSchema,
  scenario: workflowScenarioSchema.optional(),
});

export async function getSnapshot(
  activeParty: PartyRole,
  sessionId = "preview-session",
  persistedContext?: WorkflowSessionState,
): Promise<WorkflowSnapshot> {
  const client = cantonClient();
  const context = getContext(sessionId, persistedContext);
  const parties = context.parties ?? partyHints;
  const scenario = context.scenario ?? "standard";
  const bootstrapped = Boolean(context.activeAtOffset && context.parties);
  const scopedContracts = bootstrapped
    ? await queryPartyScopedContracts(client, parties as PartyDirectory, context.activeAtOffset!)
    : emptyScopedContracts();
  const rawContracts = scopedContracts[activeParty];
  const contracts = filterVisibleContracts(rawContracts, activeParty, parties as PartyDirectory);

  const mapped = mapContracts(contracts, activeParty, parties as PartyDirectory);
  const stage = inferStage(mapped);
  const receipts = makeReceipts(mapped, stage, context.lastAction);
  const recommendations = makeRecommendations(mapped.positions, mapped.calls);
  const settlementSeconds = context.bootstrapTimestamp
    ? Math.round((Date.now() - context.bootstrapTimestamp) / 1000)
    : undefined;

  return {
    mode: "canton-json-api",
    activeParty,
    parties: parties as PartyDirectory,
    stage,
    scenario,
    sessionScoped: sessionId !== "preview-session",
    contracts: [
      ...mapped.positions,
      ...mapped.cashBalances,
      ...mapped.cashTransfers,
      ...mapped.calls,
      ...mapped.terms,
      ...mapped.offers,
      ...mapped.locks,
      ...mapped.pledges,
      ...mapped.closeouts,
      ...receipts,
    ],
    receipts,
    recommendations,
    settlementSeconds,
    proof: {
      activeAtOffset: context.activeAtOffset ? String(context.activeAtOffset) : undefined,
      visibleContractCount: contracts.length,
      visibleTemplateIds: [...new Set(contracts.map((contract) => contract.templateId))],
      partyScopedQuery: `active-contracts filtered by ${parties[activeParty]}`,
      partyVisibility: makePartyVisibilityProof(scopedContracts, parties as PartyDirectory),
      lastAction: context.lastAction,
      scenario,
    },
    visibility: {
      TreasuryPosition: mapped.positions.length > 0,
      TokenizedCash: mapped.cashBalances.length > 0,
      CashTransfer: mapped.cashTransfers.length > 0,
      MarginCall: mapped.calls.length > 0,
      ExposureTerms: mapped.terms.length > 0,
      CollateralOffer: mapped.offers.length > 0,
      LockedCollateral: mapped.locks.length > 0,
      ActivePledge: mapped.pledges.length > 0,
      PledgeCloseout: mapped.closeouts.length > 0,
      AuditReceipt: receipts.length > 0,
    },
    nextActions: bootstrapped ? nextActions(stage, mapped.cashBalances.length > 0) : ["bootstrap"],
    updatedAt: new Date().toISOString(),
    updateId: context.activeAtOffset ? String(context.activeAtOffset) : undefined,
  };
}

export async function runWorkflowAction(
  action: WorkflowAction,
  options: WorkflowActionOptions = {},
): Promise<WorkflowResult> {
  const client = cantonClient();
  const context = getContext(options.sessionId ?? "preview-session", options.persistedContext);
  enforceMutationRateLimit(context);

  if (action === "bootstrap") {
    const scenario = options.scenario ?? "standard";
    const config = scenarioConfigs[scenario];
    const parties = await allocateParties(client);
    context.bootstrapTimestamp = Date.now();
    context.scenario = scenario;

    const positionResult = await submit(client, {
      userId: "ledger-api-user",
      commandId: commandId("create-positions"),
      actAs: [parties.investor, parties.custodian],
      readAs: [parties.investor, parties.custodian, parties.auditor],
      commands: config.positions.map((position) => ({
        CreateCommand: {
          templateId: templateIds.TreasuryPosition,
          createArguments: {
            investor: parties.investor,
            custodian: parties.custodian,
            auditor: parties.auditor,
            cusip: position.cusip,
            issuer: position.issuer,
            faceValue: decimalString(position.faceValue),
            marketValue: decimalString(position.marketValue),
            haircutPct: decimalString(position.haircutPct),
            maturityDate: position.maturityDate,
            liquidityTier: position.liquidityTier,
            eligible: position.eligible,
            riskNotes: position.riskNotes,
          },
        },
      })),
    });

    let cashResult: { completionOffset: number | string } | undefined;
    if (config.cash) {
      cashResult = await submit(client, {
        userId: "ledger-api-user",
        commandId: commandId("create-cash"),
        actAs: [parties.securedParty],
        readAs: [parties.securedParty, parties.investor],
        commands: [
          {
            CreateCommand: {
              templateId: templateIds.TokenizedCash,
              createArguments: {
                issuer: parties.securedParty,
                holder: parties.securedParty,
                amount: decimalString(config.cash.amount),
                currency: config.cash.currency,
                eligible: config.cash.eligible,
              },
            },
          },
        ],
      });
    }

    const terms = await submit(client, {
      userId: "ledger-api-user",
      commandId: commandId("create-exposure-terms"),
      actAs: [parties.securedParty],
      readAs: [parties.securedParty, parties.investor],
      commands: [
        {
          CreateCommand: {
            templateId: templateIds.ExposureTerms,
            createArguments: {
              securedParty: parties.securedParty,
              investor: parties.investor,
              valuationSource: config.terms.valuationSource,
              disputeWindowHours: String(config.terms.disputeWindowHours),
              closeoutThresholdPct: decimalString(config.terms.closeoutThresholdPct),
              sensitiveNote: config.terms.sensitiveNote,
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
              requiredValue: decimalString(config.call.requiredValue),
              currency: "USD",
              reason: config.call.reason,
              callType: config.call.callType,
              counterpartyExposure: decimalString(config.call.counterpartyExposure),
              minimumHaircutPct: decimalString(config.call.minimumHaircutPct),
              dueDate: config.call.dueDate,
              status: "CallOpen",
            },
          },
        },
      ],
    });

    context.parties = parties;
    context.lastAction = action;
    context.activeAtOffset = maxOffset(positionResult, cashResult, terms, call);
    return ok(action, "call-open", scenario, context.activeAtOffset, "Bootstrapped parties, inventory, private terms, and MarginCall on Canton.");
  }

  const parties = requireParties(context);
  const offset = requireOffset(context);
  const scenario = context.scenario ?? "standard";

  if (action === "offer") {
    const investorContracts = filterVisibleContracts(await queryActiveContracts(client, parties.investor, offset), "investor", parties);
    const call = requireContract(investorContracts, "MarginCall");
    const mapped = mapContracts(investorContracts, "investor", parties);
    const recommendation = requireRecommendation(makeRecommendations(mapped.positions, mapped.calls));
    const position =
      investorContracts.find((contract) => contract.contractId === recommendation.positionId) ??
      requireContract(investorContracts, "TreasuryPosition");
    const selectedPosition = mapped.positions.find((item) => item.id === recommendation.positionId);
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
              haircutPct: selectedPosition?.haircutPct.toFixed(1) ?? "2.0",
            },
          },
        },
      ],
    });
    context.activeAtOffset = Number(result.completionOffset);
    context.lastAction = action;
    return ok(action, "offer-posted", scenario, context.activeAtOffset, "Investor offered the lowest-surplus eligible Treasury position on Canton.");
  }

  if (action === "lock") {
    const custodianContracts = filterVisibleContracts(await queryActiveContracts(client, parties.custodian, offset), "custodian", parties);
    const offer = requireContract(custodianContracts, "CollateralOffer");
    const result = await submitExercise(client, parties.custodian, templateIds.CollateralOffer, offer.contractId, "LockByCustodian", {});
    context.activeAtOffset = Number(result.completionOffset);
    context.lastAction = action;
    return ok(action, "collateral-locked", scenario, context.activeAtOffset, "Custodian locked pledged collateral on Canton.");
  }

  if (action === "accept") {
    const securedContracts = filterVisibleContracts(await queryActiveContracts(client, parties.securedParty, offset), "securedParty", parties);
    const locked = requireContract(securedContracts, "LockedCollateral");
    const result = await submitExercise(client, parties.securedParty, templateIds.LockedCollateral, locked.contractId, "AcceptPledge", {});
    context.activeAtOffset = Number(result.completionOffset);
    context.lastAction = action;
    return ok(action, "pledge-active", scenario, context.activeAtOffset, "Secured party accepted the active pledge on Canton.");
  }

  if (action === "settle") {
    const securedContracts = filterVisibleContracts(await queryActiveContracts(client, parties.securedParty, offset), "securedParty", parties);
    const locked = requireContract(securedContracts, "LockedCollateral");
    const cash = requireContract(securedContracts, "TokenizedCash");
    const result = await submitExercise(client, parties.securedParty, templateIds.LockedCollateral, locked.contractId, "SettleRepo", {
      cashCid: cash.contractId,
    });
    context.activeAtOffset = Number(result.completionOffset);
    context.lastAction = action;
    return ok(
      action,
      "settled",
      scenario,
      context.activeAtOffset,
      "Atomic settlement completed: cash leg + collateral leg confirmed in one Canton transaction.",
    );
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
    context.lastAction = action;
    const stage = action === "release" ? "released" : "seized";
    return ok(
      action,
      stage,
      scenario,
      context.activeAtOffset,
      `Secured party ${action === "release" ? "released" : "seized"} collateral on Canton.`,
    );
  }

  throw new Error(`Unsupported action ${action}`);
}

export function resetWorkflowContext(sessionId: string) {
  const target = globalThis as GlobalWithContext;
  if (target[globalKey]?.sessions[sessionId]) {
    delete target[globalKey]!.sessions[sessionId];
  }
}

export function getWorkflowSessionState(sessionId: string): WorkflowSessionState {
  const context = getContext(sessionId);
  return {
    parties: context.parties,
    activeAtOffset: context.activeAtOffset,
    scenario: context.scenario,
    lastAction: context.lastAction,
    bootstrapTimestamp: context.bootstrapTimestamp,
  };
}

export async function checkCantonHealth() {
  try {
    const client = cantonClient();
    const response = await fetchWithTimeout(`${client.baseUrl}/livez`, { cache: "no-store" }, healthTimeoutMs(), "Canton health check");
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

function getContext(sessionId: string, persistedContext?: WorkflowSessionState): WorkflowContext {
  const target = globalThis as GlobalWithContext;
  target[globalKey] ??= { sessions: {} };
  target[globalKey]!.sessions[sessionId] ??= {};
  if (persistedContext) {
    target[globalKey]!.sessions[sessionId] = {
      ...target[globalKey]!.sessions[sessionId],
      ...persistedContext,
    };
  }
  return target[globalKey]!.sessions[sessionId];
}

function enforceMutationRateLimit(context: WorkflowContext) {
  const now = Date.now();
  const windowMs = 60_000;
  const maxMutations = 40;
  const recent = (context.mutationTimestamps ?? []).filter((timestamp) => now - timestamp < windowMs);

  if (recent.length >= maxMutations) {
    throw new Error("Demo mutation limit reached. Reset the session or wait before submitting more commands.");
  }

  recent.push(now);
  context.mutationTimestamps = recent;
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

async function queryPartyScopedContracts(
  client: { baseUrl: string },
  parties: PartyDirectory,
  activeAtOffset: number,
): Promise<PartyScopedContracts> {
  const entries = await Promise.all(
    roleOrder.map(async (role) => {
      const contracts = await queryActiveContracts(client, parties[role], activeAtOffset);
      return [role, filterVisibleContracts(contracts, role, parties)] as const;
    }),
  );

  return Object.fromEntries(entries) as PartyScopedContracts;
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
      witnessParties: stringArray(event.witnessParties),
      signatories: stringArray(event.signatories),
      observers: stringArray(event.observers),
    }));
}

async function postJson(client: { baseUrl: string }, path: string, body: Record<string, unknown>) {
  const response = await fetchWithTimeout(
    `${client.baseUrl}${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
    requestTimeoutMs(),
    `Canton ${path}`,
  );

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${text}`);
  }

  return json;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, label: string) {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`${label} did not respond within ${Math.round(timeoutMs / 1000)}s. If the Render backend is waking up, wait a moment and retry.`);
    }
    throw error;
  }
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
  return filterCurrentContextContracts(contracts, parties).filter((contract) => isVisibleToRole(contract, role, parties));
}

function filterCurrentContextContracts(contracts: CantonContract[], parties: PartyDirectory): CantonContract[] {
  return contracts.filter((contract) => isCurrentContext(contract, parties));
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

  if (contract.witnessParties?.length) return contract.witnessParties.includes(party);

  if (contract.templateId.includes(":CollateralOps:CashTransfer") || contract.templateId.includes(":CollateralOps:TokenizedCash")) {
    if (contract.observers?.includes(party)) return true;
    if (contract.signatories?.includes(party)) return true;
    return false;
  }

  if (role === "investor") return text(payload.investor) === party;
  if (role === "securedParty") return text(payload.securedParty) === party;
  if (role === "custodian") {
    return text(payload.custodian) === party && !contract.templateId.includes(":CollateralOps:MarginCall");
  }
  if (role === "auditor") return text(payload.auditor) === party;
  return false;
}

function maxOffset(...responses: ({ completionOffset: number | string } | undefined)[]): number {
  return Math.max(...responses.filter(Boolean).map((item) => Number(item!.completionOffset)));
}

function ok(
  action: WorkflowAction,
  stage: WorkflowStage,
  scenario: WorkflowScenario,
  offset: number | undefined,
  message: string,
): WorkflowResult {
  return {
    ok: true,
    mode: "canton-json-api",
    action,
    stage,
    scenario,
    updateId: offset ? String(offset) : undefined,
    message,
  };
}

function commandId(action: string) {
  return `collateralops-${action}-${Date.now()}`;
}

function healthTimeoutMs() {
  return Number(process.env.CANTON_HEALTH_TIMEOUT_MS ?? 8_000);
}

function requestTimeoutMs() {
  return Number(process.env.CANTON_REQUEST_TIMEOUT_MS ?? 25_000);
}

interface MappedContracts {
  activeParty: PartyRole;
  parties: PartyDirectory;
  positions: TreasuryPosition[];
  cashBalances: TokenizedCash[];
  cashTransfers: CashTransfer[];
  calls: MarginCall[];
  terms: ExposureTerms[];
  offers: CollateralOffer[];
  locks: LockedCollateral[];
  pledges: ActivePledge[];
  closeouts: PledgeCloseout[];
}

function mapContracts(contracts: CantonContract[], activeParty: PartyRole, parties: PartyDirectory): MappedContracts {
  const positions: TreasuryPosition[] = [];
  const cashBalances: TokenizedCash[] = [];
  const cashTransfers: CashTransfer[] = [];
  const calls: MarginCall[] = [];
  const terms: ExposureTerms[] = [];
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
    } else if (contract.templateId.includes(":CollateralOps:TokenizedCash")) {
      cashBalances.push({
        id: contract.contractId,
        kind: "TokenizedCash",
        issuer: text(contract.payload.issuer),
        holder: text(contract.payload.holder),
        amount: decimal(contract.payload.amount),
        currency: text(contract.payload.currency),
        eligible: boolean(contract.payload.eligible),
      });
    } else if (contract.templateId.includes(":CollateralOps:CashTransfer")) {
      cashTransfers.push({
        id: contract.contractId,
        kind: "CashTransfer",
        from: text(contract.payload.from),
        to: text(contract.payload.to),
        amount: decimal(contract.payload.amount),
        currency: text(contract.payload.currency),
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
    } else if (contract.templateId.includes(":CollateralOps:ExposureTerms")) {
      terms.push({
        id: contract.contractId,
        kind: "ExposureTerms",
        securedParty: text(contract.payload.securedParty),
        investor: text(contract.payload.investor),
        valuationSource: text(contract.payload.valuationSource),
        disputeWindowHours: integer(contract.payload.disputeWindowHours),
        closeoutThresholdPct: decimal(contract.payload.closeoutThresholdPct),
        sensitiveNote: text(contract.payload.sensitiveNote),
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
      const rawStatus = enumText(contract.payload.terminalStatus);
      let terminalStatus: ActivePledge["terminalStatus"] = "active";
      if (rawStatus === "Settled") terminalStatus = "settled";
      else if (rawStatus === "Released") terminalStatus = "released";
      else if (rawStatus === "Seized") terminalStatus = "seized";

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
        terminalStatus,
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

  return { activeParty, parties, positions, cashBalances, cashTransfers, calls, terms, offers, locks, pledges, closeouts };
}

function inferStage(mapped: MappedContracts): WorkflowStage {
  if (mapped.closeouts.some((closeout) => closeout.finalStatus === "seized")) return "seized";
  if (mapped.closeouts.some((closeout) => closeout.finalStatus === "released")) return "released";
  if (mapped.cashTransfers.length > 0) return "settled";
  if (mapped.pledges.length > 0) return "pledge-active";
  if (mapped.locks.length > 0) return "collateral-locked";
  if (mapped.offers.length > 0) return "offer-posted";
  if (mapped.calls.length > 0) return "call-open";
  return "call-open";
}

function inferEncumbrance(contracts: CantonContract[]): TreasuryPosition["encumbrance"] {
  const closeout = contracts.find((contract) => contract.templateId.includes(":CollateralOps:PledgeCloseout"));
  if (closeout) return enumText(closeout.payload.finalStatus) === "Seized" ? "seized" : "released";
  if (contracts.some((contract) => contract.templateId.includes(":CollateralOps:CashTransfer"))) return "settled";
  if (contracts.some((contract) => contract.templateId.includes(":CollateralOps:ActivePledge"))) return "pledged";
  if (contracts.some((contract) => contract.templateId.includes(":CollateralOps:LockedCollateral"))) return "locked";
  if (contracts.some((contract) => contract.templateId.includes(":CollateralOps:CollateralOffer"))) return "offered";
  return "free";
}

function nextActions(stage: WorkflowStage, hasCash = false): WorkflowAction[] {
  if (stage === "call-open") return ["offer"];
  if (stage === "offer-posted") return ["lock"];
  if (stage === "collateral-locked") return hasCash ? ["accept", "settle"] : ["accept"];
  if (stage === "pledge-active" || stage === "settled") return ["release", "default"];
  return ["bootstrap"];
}

function makeReceipts(
  mapped: MappedContracts,
  stage: WorkflowStage,
  lastAction: WorkflowAction | undefined,
): AuditReceipt[] {
  if (mapped.activeParty === "custodian") return [];

  const timestamp = new Date().toISOString();
  const receipts: AuditReceipt[] = [];
  if (mapped.calls.length > 0) receipts.push(receipt("bootstrap", "securedParty", timestamp, "NorthBank opened a Canton margin call."));
  if (mapped.terms.length > 0) receipts.push(receipt("bootstrap", "securedParty", timestamp, "Private exposure terms were disclosed only to AtlasFund and NorthBank."));
  if (mapped.offers.length > 0) receipts.push(receipt("offer", "investor", timestamp, "AtlasFund offered tokenized UST collateral."));
  if (mapped.locks.length > 0) receipts.push(receipt("lock", "custodian", timestamp, "ClearVault locked the pledged position."));
  if (mapped.cashTransfers.length > 0) receipts.push(receipt("settle", "securedParty", timestamp, "Atomic repo settlement: cash + collateral confirmed in one Canton transaction."));
  if ((mapped.pledges.length > 0 || stage === "pledge-active") && !mapped.cashTransfers.length) receipts.push(receipt("accept", "securedParty", timestamp, "NorthBank accepted the active pledge."));
  if (stage === "released") receipts.push(receipt("release", "securedParty", timestamp, "NorthBank released the collateral on Canton."));
  if (stage === "seized") receipts.push(receipt("default", "securedParty", timestamp, "NorthBank seized the collateral on Canton."));
  return receipts.map((item) => ({ ...item, updateId: lastAction }));
}

function receipt(action: WorkflowAction, actor: PartyRole, timestamp: string, summary: string): AuditReceipt {
  return {
    id: `receipt-${action}-${summary.slice(0, 12).replace(/\W/g, "").toLowerCase()}`,
    kind: "AuditReceipt",
    callId: "call",
    visibleTo: ["investor", "securedParty", "auditor"],
    action,
    actor,
    timestamp,
    summary,
  };
}

function makePartyVisibilityProof(scopedContracts: PartyScopedContracts, parties: PartyDirectory): PartyVisibilityProof[] {
  return roleOrder.map((role) => {
    const contracts = scopedContracts[role] ?? [];
    const visibleTemplateIds = [...new Set(contracts.map((contract) => contract.templateId))];
    const seesPrivateTerms = visibleTemplateIds.some((templateId) => templateId.includes(":CollateralOps:ExposureTerms"));
    const seesCashLeg = visibleTemplateIds.some((templateId) =>
      templateId.includes(":CollateralOps:CashTransfer") || templateId.includes(":CollateralOps:TokenizedCash"),
    );

    const hiddenTemplates: string[] = [];
    if (!seesPrivateTerms) hiddenTemplates.push("ExposureTerms");
    if (!seesCashLeg) hiddenTemplates.push("CashTransfer", "TokenizedCash");

    return {
      role,
      party: parties[role],
      visibleContractCount: contracts.length,
      visibleTemplateIds,
      seesPrivateTerms,
      seesCashLeg,
      hiddenSensitiveTemplates: hiddenTemplates,
    };
  });
}

function emptyScopedContracts(): PartyScopedContracts {
  return {
    investor: [],
    securedParty: [],
    custodian: [],
    auditor: [],
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

function integer(value: unknown) {
  return Math.trunc(decimal(value));
}

function boolean(value: unknown) {
  return value === true || value === "true";
}

function enumText(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "tag" in value && typeof value.tag === "string") return value.tag;
  return text(value);
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => text(item)) : undefined;
}

function postHaircutValue(marketValue: number, haircutPct: number) {
  return marketValue * (1 - haircutPct / 100);
}

function decimalString(value: number) {
  return value.toFixed(1);
}

export function makeRecommendations(positions: TreasuryPosition[], calls: MarginCall[]): CollateralRecommendation[] {
  const call = calls[0];
  if (!call) return [];

  const evaluated = positions.map((position) => {
    const rejectionReasons = [];
    if (!position.eligible) rejectionReasons.push("Position is not eligible for this call.");
    if (position.haircutPct < call.minimumHaircutPct) rejectionReasons.push("Haircut is below secured-party minimum.");
    if (position.postHaircutValue < call.requiredValue) rejectionReasons.push("Post-haircut value is below required collateral.");

    const coverageRatio = position.postHaircutValue / call.requiredValue;
    const surplusValue = position.postHaircutValue - call.requiredValue;
    const selectable = rejectionReasons.length === 0;

    return {
      positionId: position.id,
      cusip: position.cusip,
      pledgeAmount: position.postHaircutValue,
      postHaircutValue: position.postHaircutValue,
      coverageRatio,
      surplusValue,
      rank: 0,
      selectable,
      selectionReason: selectable
        ? `Eligible with ${Math.round(coverageRatio * 100)}% coverage and ${Math.round(surplusValue).toLocaleString("en-US")} USD surplus.`
        : "Rejected by secured-party collateral policy.",
      rationale: selectable
        ? `${position.liquidityTier} ${position.issuer} collateral covers ${Math.round(coverageRatio * 100)}% of the requirement after haircut.`
        : `${position.liquidityTier} ${position.issuer} collateral is visible but not selectable for this call.`,
      warnings: rejectionReasons,
      rejectionReasons,
    };
  });

  const selectable = evaluated
    .filter((recommendation) => recommendation.selectable)
    .sort((left, right) => left.surplusValue - right.surplusValue || left.coverageRatio - right.coverageRatio)
    .map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));

  const rejected = evaluated
    .filter((recommendation) => !recommendation.selectable)
    .sort((left, right) => left.cusip.localeCompare(right.cusip));

  return [...selectable, ...rejected];
}

function requireRecommendation(recommendations: CollateralRecommendation[]) {
  const recommendation = recommendations.find((item) => item.selectable);
  if (!recommendation) {
    throw new Error("No eligible collateral recommendation is visible to the investor.");
  }
  return recommendation;
}
