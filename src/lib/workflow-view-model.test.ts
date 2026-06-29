import { describe, expect, it } from "vitest";
import { buildWorkflowViewModel, workflowSteps } from "./workflow-view-model";
import type { WorkflowSnapshot } from "./types";

const baseSnapshot: WorkflowSnapshot = {
  mode: "canton-json-api",
  activeParty: "investor",
  parties: {
    investor: "AtlasFund::1220",
    securedParty: "NorthBank::1220",
    custodian: "ClearVault::1220",
    auditor: "RegSight::1220",
  },
  stage: "call-open",
  scenario: "standard",
  sessionScoped: false,
  contracts: [],
  receipts: [],
  recommendations: [],
  proof: {
    visibleContractCount: 0,
    visibleTemplateIds: [],
    partyScopedQuery: "active-contracts filtered by AtlasFund::1220",
    partyVisibility: [
      {
        role: "investor",
        party: "AtlasFund::1220",
        visibleContractCount: 0,
        visibleTemplateIds: [],
        seesPrivateTerms: false,
        hiddenSensitiveTemplates: ["ExposureTerms"],
      },
      {
        role: "securedParty",
        party: "NorthBank::1220",
        visibleContractCount: 0,
        visibleTemplateIds: [],
        seesPrivateTerms: false,
        hiddenSensitiveTemplates: ["ExposureTerms"],
      },
      {
        role: "custodian",
        party: "ClearVault::1220",
        visibleContractCount: 0,
        visibleTemplateIds: [],
        seesPrivateTerms: false,
        hiddenSensitiveTemplates: ["ExposureTerms"],
      },
      {
        role: "auditor",
        party: "RegSight::1220",
        visibleContractCount: 0,
        visibleTemplateIds: [],
        seesPrivateTerms: false,
        hiddenSensitiveTemplates: ["ExposureTerms"],
      },
    ],
    scenario: "standard",
  },
  visibility: {
    TreasuryPosition: false,
    MarginCall: false,
    ExposureTerms: false,
    CollateralOffer: false,
    LockedCollateral: false,
    ActivePledge: false,
    PledgeCloseout: false,
    AuditReceipt: false,
  },
  nextActions: ["bootstrap"],
  updatedAt: "2026-06-29T00:00:00.000Z",
};

describe("buildWorkflowViewModel", () => {
  it("frames an empty process as a fresh workflow start", () => {
    const model = buildWorkflowViewModel(baseSnapshot);

    expect(model.isFreshStart).toBe(true);
    expect(model.stageLabel).toBe("Ready to start");
    expect(model.primaryIntent).toBe("Start workflow");
    expect(model.proofStatus).toBe("Not bootstrapped");
  });

  it("surfaces margin-call and recommendation details for the operator briefing", () => {
    const model = buildWorkflowViewModel({
      ...baseSnapshot,
      stage: "call-open",
      proof: {
        ...baseSnapshot.proof,
        activeAtOffset: "42",
        visibleContractCount: 2,
      },
      nextActions: ["offer"],
      contracts: [
        {
          id: "call-1",
          kind: "MarginCall",
          securedParty: "NorthBank",
          investor: "AtlasFund",
          auditor: "RegSight",
          requiredValue: 4_750_000,
          currency: "USD",
          reason: "Intraday repo exposure breach",
          callType: "Repo margin call",
          counterpartyExposure: 11_900_000,
          minimumHaircutPct: 2,
          dueDate: "2026-06-17T18:00:00Z",
          status: "call-open",
        },
      ],
      recommendations: [
        {
          positionId: "position-1",
          cusip: "91282CJC6",
          pledgeAmount: 4_750_000,
          postHaircutValue: 4_865_700,
          coverageRatio: 1.024,
          surplusValue: 115_700,
          rank: 1,
          selectable: true,
          selectionReason: "Eligible with 102% coverage.",
          rationale: "Tier 1 Treasury collateral covers 102% of the requirement after haircut.",
          warnings: [],
          rejectionReasons: [],
        },
      ],
    });

    expect(model.isFreshStart).toBe(false);
    expect(model.primaryIntent).toBe("Offer collateral");
    expect(model.requiredValue).toBe("$4,750,000");
    expect(model.exposureValue).toBe("$11,900,000");
    expect(model.recommendedCoverage).toBe("102%");
    expect(model.proofStatus).toBe("Offset 42");
  });
});

describe("workflowSteps", () => {
  it("marks completed, current, and pending handoff steps", () => {
    expect(workflowSteps("collateral-locked", true).map((step) => step.state)).toEqual([
      "complete",
      "complete",
      "current",
      "pending",
      "pending",
      "pending",
    ]);
  });
});
