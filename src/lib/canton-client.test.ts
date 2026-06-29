import { describe, expect, it } from "vitest";
import { makeRecommendations } from "./canton-client";
import type { MarginCall, TreasuryPosition } from "./types";

const baseCall: MarginCall = {
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
};

function position(overrides: Partial<TreasuryPosition>): TreasuryPosition {
  return {
    id: "position-1",
    kind: "TreasuryPosition",
    investor: "AtlasFund",
    custodian: "ClearVault",
    auditor: "RegSight",
    cusip: "91282CJC6",
    issuer: "U.S. Treasury",
    faceValue: 5_000_000,
    marketValue: 4_965_000,
    haircutPct: 2,
    maturityDate: "2028-01-31",
    liquidityTier: "Tier 1",
    eligible: true,
    riskNotes: "Custodian verified.",
    postHaircutValue: 4_865_700,
    encumbrance: "free",
    ...overrides,
  };
}

describe("makeRecommendations", () => {
  it("ranks eligible collateral by lowest sufficient post-haircut surplus", () => {
    const recommendations = makeRecommendations(
      [
        position({ id: "small", cusip: "91282CJA0", marketValue: 4_900_000, postHaircutValue: 4_802_000 }),
        position({ id: "large", cusip: "91282CJC6", marketValue: 4_965_000, postHaircutValue: 4_865_700 }),
      ],
      [baseCall],
    );

    expect(recommendations).toHaveLength(2);
    expect(recommendations[0]).toMatchObject({ positionId: "small", rank: 1, selectable: true });
    expect(recommendations[0].warnings).toEqual([]);
    expect(recommendations[0].surplusValue).toBe(52_000);
  });

  it("keeps rejected collateral visible with policy reasons", () => {
    const recommendations = makeRecommendations(
      [
        position({ id: "ineligible", eligible: false }),
        position({ id: "low-haircut", haircutPct: 1 }),
        position({ id: "under-covered", postHaircutValue: 4_000_000 }),
      ],
      [baseCall],
    );

    expect(recommendations).toHaveLength(3);
    expect(recommendations.every((recommendation) => !recommendation.selectable)).toBe(true);
    expect(recommendations.map((recommendation) => recommendation.rejectionReasons[0])).toEqual([
      "Position is not eligible for this call.",
      "Haircut is below secured-party minimum.",
      "Post-haircut value is below required collateral.",
    ]);
  });
});
