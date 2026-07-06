# CollateralOps — Private Atomic Repo on Canton

CollateralOps is a private, atomic repo settlement terminal backed by Canton Network. It turns a multi-party margin call into an atomic DvP (Delivery-vs-Payment) workflow: tokenized Treasury collateral AND tokenized cash settle in one Canton transaction — all-or-nothing, with sub-transaction privacy by default.

Built for the **Build on Canton Hackathon** (Encode Club × Canton Foundation, July 2026). Primary entry: **Track 2 (TradeFi, RWA & Tokenized Assets)**, with cross-cutting claims on **Track 1 (Private DeFi & Capital Markets)** and **Track 3 (Agentic Commerce)**.

## Why This Needs Canton (Impossible on EVM)

| Capability | Canton | EVM / Solana |
|---|---|---|
| **Atomic cross-leg DvP** | Cash + collateral settle in one Daml transaction — both legs succeed or both revert | Requires sequential execution or lock/unlock patterns with race conditions |
| **Party-scoped privacy** | Custodian and auditor CANNOT see bilateral ExposureTerms or CashTransfer — enforced by Daml signatory/observer rules | All state is globally visible; privacy requires ZK (complex, breaks composability) or sidechains (breaks atomicity) |
| **Multi-party authorization** | `SettleRepo` fetches TokenizedCash, asserts eligibility, creates CashTransfer AND ActivePledge — all with in-type `controller`/`signatory` restrictions | Authorization requires manual `require(msg.sender)` checks scattered across functions |
| **No global state leakage** | Each party queries only their own view; the Synchronizer never sees contract data | Every node replicates every contract; privacy is an application-layer afterthought |

**The repo demo proves it:** `workflowAtomicDvpFailure` Daml Script test asserts that when cash is insufficient, NO CashTransfer is visible to the investor, and NO ActivePledge is visible to the secured party. The entire multi-leg transaction rolls back. This is structurally impossible on EVM.

## Tracks

- **Primary: Track 2 — TradeFi, RWA & Tokenized Assets** — tokenized Treasury collateral mobility with atomic repo settlement, blind multi-investor collateral auction
- **Cross-claim: Track 1 — Private DeFi & Capital Markets** — bilateral repo with party-scoped privacy, no public order book leakage
- **Cross-claim: Track 3 — Agentic Commerce** — AI agent exercises Daml choices autonomously via `/api/agent`

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

## Why Canton

This product needs Canton because the workflow is **multi-party, private, stateful, and requires atomic cross-leg settlement**.

Canton primitives exploited:

- **Atomic DvP**: `LockedCollateral.SettleRepo` creates `CashTransfer` AND `ActivePledge` in one choice — Daml transactional all-or-nothing.
- **Party-scoped visibility**: `CashTransfer` has `signatory from, observer to` — custodian and auditor cannot query it. `ExposureTerms` has `signatory securedParty, observer investor` — hidden from custodian and auditor.
- **Daml authorization**: signatories, observers, and controllers define who can create, see, and exercise each contract.
- **Daml Script tests verify atomicity**: `workflowAtomicDvpFailure` proves the failure branch leaves zero cash transfer and zero pledge — the impossible-on-EVM proof.
- **Private bilateral terms**: sensitive exposure terms are visible to the investor and secured party, but hidden from the custodian and auditor.
- **No global public state leakage**: the product can prove workflow progress without exposing a global order book.

## Architecture

```text
Browser
  |
  | Next.js UI (+ agent copilot, privacy redaction, settlement clock)
  v
Vercel (Next.js API routes + /api/agent)
  |
  | signed demo session + role-scoped command routing
  |  ↓  CANTON_JSON_API_URL → self-hosted Canton (tunnel)
  v
Canton JSON Ledger API
  |
  v
Daml contracts (12 templates, 13 script tests)
```

Main parts:

- `src/app/page.tsx`: command-center UI with party-scoped redaction.
- `src/lib/canton-client.ts`: Canton JSON API client, atomic settle action, party-scoped mapping, collateral recommendation, settlement clock.
- `src/lib/demo-session.ts`: signed demo session and workflow-context cookies.
- `src/app/api/agent/*`: AI agent route (Dgrid AI — OpenAI-compatible).
- `src/app/api/workflow/*`: server routes for snapshots, actions, bootstrap, recommendations.
- `src/app/api/demo/*`: access-key session and reset routes.
- `contracts/daml/CollateralOps.daml`: Daml templates — 9 templates, 10 script tests (3 new atomic/DvP/privacy).
- `scripts/canton-json-proof.sh`: end-to-end HTTP proof.

## Daml Model

Core templates (12 total):

- `TreasuryPosition`: tokenized UST position.
- `TokenizedCash`: cash reserve held by the secured party.
- `CashTransfer`: atomic transfer record created during settlement. signatory: from, observer: to — custodian and auditor never see it.
- `MarginCall`: secured-party call against an investor.
- `ExposureTerms`: bilateral private terms (signatory: securedParty, observer: investor).
- `CollateralOffer`: investor offer of a specific Treasury position.
- `LockedCollateral`: custodian proof that the pledged asset is locked.
- `ActivePledge`: secured-party accepted pledge.
- `PledgeCloseout`: final release or seizure record.
- `CollateralBid` (U6 — NEW): private bid in a blind multi-investor auction. signatory: investor, observer: custodian only. Other investors cannot query rival bids.
- `AuditEvidence` (U7 — NEW): time-bounded regulatory audit disclosure. Non-consuming choice on PledgeCloseout preserves the closeout record.
- `TokenComplianceCheck` (U9 — NEW): custodian-certified token standard compliance stamp. signatory: custodian, observer: auditor.

Daml choices:

- `OfferCollateral`
- `LockByCustodian`
- `AcceptPledge` (single-leg, backward compatible)
- `SettleRepo` (NEW — atomic DvP: creates CashTransfer + ActivePledge in one transaction)
- `ReleaseCollateral`
- `SeizeCollateral`

Daml Script tests (13 total, all passing):

- `workflowHappyPath` — standard release
- `workflowDefaultPath` — seizure closeout
- `workflowPrivacyVisibility` — ExposureTerms hidden from custodian/auditor
- `workflowWrongPartyRejected` — authorization enforcement
- `workflowAtomicSettlement` — happy atomic DvP: verifies CashTransfer amount and PledgeTerminal status
- `workflowAtomicDvpFailure` — insufficient cash: proves zero CashTransfer, zero ActivePledge (impossible on EVM)
- `workflowPrivacyDvp` — cash leg hidden from custodian/auditor
- `workflowBlindAuction` (U6 — NEW): 3 investors bid blindly; custodian sees all, investors see only their own, custodian selects winner
- `workflowAuditEvidence` (U7 — NEW): auditor requests time-bounded evidence via non-consuming choice on PledgeCloseout
- `workflowTokenCompliance` (U9 — NEW): custodian certifies token standard compliance; auditor sees, investor does not

## API Routes

```text
GET  /api/status
POST /api/demo/session
POST /api/demo/reset
GET  /api/workflow/snapshot?party=investor
POST /api/workflow/bootstrap
POST /api/workflow/action
POST /api/workflow/recommend
POST /api/agent                     ← NEW: AI agent co-pilot
```

Supported workflow actions:

```text
bootstrap
offer
lock
accept
settle      ← NEW: atomic DvP repo settlement
release
default
```

## Run Locally

Install dependencies:

```bash
pnpm install
```

Build and test the Daml package:

```bash
cd contracts
dpm build
dpm test
```

### Quick start (both Canton sandbox + web app in one command)

Copy `.env.example` to `.env.local` and fill in any optional keys, then:

```bash
pnpm dev:full
```

This builds the Daml archive, starts Canton sandbox on port 7575, waits for it, then starts the Next.js dev server on port 3000.

### Manual start

In one shell, start the Canton sandbox:

```bash
cd contracts
dpm sandbox --json-api-port 7575 --dar .daml/dist/collateralops-0.1.0.dar
```

In another shell, start the web app:

```bash
cp .env.example .env.local   # first time only
pnpm dev
```

For the AI agent, set the optional `LLM_API_KEY` in `.env.local`:

```text
LLM_API_KEY=sk-your-dgrid-key
LLM_BASE_URL=https://api.dgrid.ai
LLM_MODEL=openai/gpt-4o
```

Open:

```text
http://localhost:3000
```

## Verification

```bash
pnpm check
cd contracts && dpm build && dpm test
```

## Live Deployment

The recommended free approach: **run Canton on a local/self-hosted machine, tunnel it, and deploy the UI to Vercel.**
Full deployment guide: [LIVE_PRODUCT_GUIDE.md](./LIVE_PRODUCT_GUIDE.md).
