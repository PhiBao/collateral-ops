# CollateralOps — Private Atomic Repo on Canton

CollateralOps is a private, atomic repo settlement terminal on Canton DevNet. It proves institutional collateral workflows are structurally impossible on transparent blockchains.

A secured party (NorthBank) issues a margin call. An investor (AtlasFund) selects Treasury collateral. A custodian (ClearVault) locks the position. Then the secured party settles atomically — cash leg AND collateral leg in ONE Canton transaction. All-or-nothing. The custodian and auditor literally cannot query the cash leg or bilateral terms.

Built for the **Build on Canton Hackathon** (Encode Club × Canton Foundation, July 2026).
Primary: **Track 2 (TradeFi, RWA & Tokenized Assets)** | Cross-claims: Track 1, Track 3.

## Why This Needs Canton

| Capability | Canton | EVM / Solana |
|---|---|---|
| **Atomic cross-leg DvP** | One Daml transaction — both legs succeed or both revert | Sequential execution with counterparty risk window |
| **Party-scoped privacy** | Custodian/auditor CANNOT query CashTransfer or ExposureTerms — enforced by Daml signatory/observer | All state globally visible |
| **Blind auction** | `CollateralBid` has `observer=custodian ONLY` — rivals literally cannot see bids | Every bid leaked to everyone |
| **Non-consuming audit** | `RequestEvidence` on PledgeCloseout preserves the record while creating time-bounded evidence | No native concept |
| **Zero global state leakage** | Each party queries only their own view; Synchronizer never sees contract data | Every node replicates every contract |

**The proof**: `workflowAtomicDvpFailure` test — insufficient cash → assert 0 CashTransfers + 0 ActivePledges = total atomic rollback. `cd contracts && dpm test` (13/13 passing).

## The Problem

Collateral operations are too manual, too slow, and too transparent for institutional repo workflows.

In a typical margin-call workflow:

- The secured party needs collateral quickly — often intraday or over the weekend.
- The investor needs to choose eligible collateral without over-pledging.
- The custodian must prove the asset is locked and cannot be reused.
- The auditor needs evidence without unrestricted ledger visibility.
- **The cash leg and collateral leg must settle atomically** — no one should be exposed to "half-settlement" risk.
- **Every party needs the same workflow state, but not the same private data.**

Traditional tools solve this with emails, PDFs, and T+1 reconciliation. Public-blockchain apps expose sensitive bilateral terms to the entire network. CollateralOps compresses this into a private, atomic Canton terminal.

## Who It Is For

- Treasury operations teams managing tokenized collateral.
- Buy-side or fund operators responding to margin calls.
- Secured lenders and repo desks settling with atomic DvP.
- Custodians responsible for asset lock and encumbrance proof.
- Audit or risk teams that need restricted evidence — without seeing cash legs or bilateral terms.

## What The Product Does

CollateralOps supports a complete atomic repo lifecycle across four demo scenarios:

1. **Margin call intake**: NorthBank opens a private repo margin call against AtlasFund.
2. **Collateral recommendation**: the app selects eligible UST collateral with the smallest sufficient post-haircut surplus.
3. **Investor offer**: AtlasFund offers the recommended tokenized Treasury position.
4. **Custody lock**: ClearVault locks the asset and proves it is encumbered.
5. **Atomic DvP settlement**: NorthBank exercises `SettleRepo` — cash leg (TokenizedCash → CashTransfer) AND collateral leg (LockedCollateral → ActivePledge) are created in ONE Canton transaction. If either leg fails, neither succeeds.
6. **Blind multi-investor collateral auction** (NEW): three investors submit private `CollateralBid` contracts visible only to themselves and the custodian. The custodian selects the winning bid, proving Canton's sub-transaction privacy enables blind-auction B2B marketplaces impossible on transparent chains.
7. **Closeout**: NorthBank either releases collateral after exposure normalizes or seizes it after default.
8. **Restricted audit evidence**: RegSight sees the allowed proof trail without seeing the cash transfer, bilateral terms, or cash reserve. Auditors can request time-bounded `AuditEvidence` via a non-consuming choice on `PledgeCloseout` — regulatory disclosure without global visibility.
9. **Token standard compliance** (NEW): `TokenComplianceCheck` marks Treasury positions against the CIP-0056 token standard, custodian-certified, auditor-visible — demonstrates composable compliance primitives.
10. **Agentic co-pilot**: an AI agent observes the workflow state and can autonomously exercise the next Canton action via `/api/agent`.

Demo scenarios:

- `standard`: clean margin call with multiple visible collateral candidates.
- `default-risk`: same workflow staged to show the seizure/default branch.
- `undercovered`: rejected collateral remains visible with policy reasons before the app selects a fallback asset.
- `weekend-stress` (NEW): Saturday 02:30 UTC margin call with atomic DvP repo settlement — demonstrates 24/7 intraday capability.

## Architecture

```
Browser → Vercel → Canton DevNet (Seaport, OAuth JWT, read-only for now)
                        ↓
         Daml: 12 templates · 20 choices · 13 script tests
```

- **Frontend**: Next.js 16, React 19, TypeScript, party-scoped UI with privacy redaction
- **Backend**: Next.js API routes → Canton JSON Ledger API v2
- **Smart contracts**: Daml — `contracts/daml/CollateralOps.daml`
- **Auth**: OAuth JWT (auto-refresh every 7h) via Seaport/Keycloak
- **Testing**: 13 Daml Script tests, 5 Vitest tests

## Quick Start

```bash
pnpm install
cp .env.example .env.local
cd contracts && dpm build && dpm test && cd ..
pnpm dev
```

Open http://localhost:3000. Enter demo key: `demo`. The app shows "Live Canton connection" from DevNet.

## Run Locally

```bash
pnpm install
cd contracts && dpm build && dpm test
```

In another shell:

```bash
cp .env.example .env.local
pnpm dev
```

For the AI agent (optional):

```text
LLM_API_KEY=sk-your-key
LLM_MODEL=openai/gpt-4o
```

## Verification

```bash
pnpm check
cd contracts && dpm build && dpm test
```

## Deploy to Vercel

Create a Vercel project from this repo. Set env vars from `.env.example`. Add `DEMO_ACCESS_KEY` and `DEMO_SESSION_SECRET`.

## Features

| Feature | Description |
|---|---|
| Atomic DvP repo | CashTransfer + ActivePledge in one Daml `do` block |
| Sub-transaction privacy | Auditor CANNOT see cash leg or bilateral terms at ledger level |
| Blind multi-investor auction | 3 investors bid privately — Canton privacy IS the auction mechanism |
| Agentic co-pilot | AI reads Canton snapshot, recommends/executes next action |
| Non-consuming audit | Time-bounded AuditEvidence without destroying PledgeCloseout |
| Token compliance | CIP-0056-style compliance stamp |

## Daml Model

12 templates: TreasuryPosition, TokenizedCash, CashTransfer, MarginCall, ExposureTerms, CollateralOffer, LockedCollateral, ActivePledge, PledgeCloseout, CollateralBid, AuditEvidence, TokenComplianceCheck.

13 Daml Script tests — all passing, 100% template coverage.

## Links

- **Package ID**: `c4e6eea250749ec23efd6b2d8d8c3bf612604bc66c51d3ed8f706994e2323e35`
- **DevNet**: https://ledger-api.validator.devnet.sandbox.fivenorth.io
- **Source**: github.com/PhiBao/collateral-ops
