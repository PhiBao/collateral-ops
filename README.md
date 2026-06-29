# CollateralOps Command Center

CollateralOps Command Center is a private collateral mobility terminal for tokenized Treasury workflows on Canton.

It helps an institutional collateral team respond to a margin call without turning a sensitive multi-party workflow into a public shared dashboard. An investor receives a repo margin call, the app recommends eligible tokenized UST collateral, a custodian locks the position, a secured party accepts the pledge, and an auditor receives the evidence it is allowed to see.

The product thesis is simple: tokenized real-world assets become more useful when collateral movement is fast, private, auditable, and operationally understandable.

## The Problem

Collateral operations are still too manual for markets that increasingly expect real-time settlement.

In a typical margin-call workflow:

- The secured party needs collateral quickly.
- The investor needs to choose eligible collateral without over-pledging.
- The custodian must prove the asset is locked and cannot be reused.
- The auditor needs evidence without unrestricted ledger visibility.
- Every party needs the same workflow state, but not the same private data.

Traditional tools solve this with emails, PDFs, reconciliation queues, and broad internal dashboards. Public-chain style applications solve it poorly because the workflow is naturally private and role-specific.

CollateralOps compresses that workflow into a single operator terminal backed by Canton contracts.

## Who It Is For

Initial users:

- Treasury operations teams managing tokenized collateral.
- Buy-side or fund operators responding to margin calls.
- Secured lenders and repo desks accepting collateral pledges.
- Custodians responsible for asset lock and encumbrance proof.
- Audit or risk teams that need restricted evidence trails.

The interface is intentionally built like an operations terminal, not a consumer wallet or generic analytics page.

## What The Product Does

CollateralOps currently supports one complete collateral pledge lifecycle across three demo scenarios:

1. **Margin call intake**: NorthBank opens a private repo margin call against AtlasFund.
2. **Collateral recommendation**: the app selects eligible UST collateral with the smallest sufficient post-haircut surplus.
3. **Investor offer**: AtlasFund offers the recommended tokenized Treasury position.
4. **Custody lock**: ClearVault locks the asset and proves it is encumbered.
5. **Secured-party acceptance**: NorthBank accepts the locked collateral as an active pledge.
6. **Closeout**: NorthBank either releases collateral after exposure normalizes or seizes it after default.
7. **Restricted audit evidence**: RegSight sees the allowed proof trail without seeing every private contract.

Demo scenarios:

- `standard`: clean margin call with multiple visible collateral candidates.
- `default-risk`: same workflow staged to show the seizure/default branch.
- `undercovered`: rejected collateral remains visible with policy reasons before the app selects a fallback asset.

## Why Canton

This product needs Canton because the workflow is multi-party, private, and stateful.

The important Canton fit:

- **Party-scoped visibility**: each role queries the same workflow from its own view.
- **Daml authorization**: signatories, observers, and controllers define who can create, see, and exercise each contract.
- **Atomic state transitions**: offer, lock, accept, release, and default closeout are explicit ledger transitions.
- **Private bilateral terms**: sensitive exposure terms are visible to the investor and secured party, but hidden from the custodian and auditor.
- **Institutional asset logic**: tokenized Treasuries, custody locks, margin calls, and audit evidence are natural regulated-finance workflows.
- **No global public state leakage**: the product can prove workflow progress without exposing a global order book.

## Product Surface

The command center has four operating zones:

- **Party View**: switch between investor, secured party, custodian, and auditor.
- **Scenario Runner**: start a standard, default-risk, or fallback-collateral workflow.
- **Workflow Command Stack**: submit the next valid Canton command for the current state.
- **Collateral Operations Panels**: margin call, private terms, recommendation, inventory, audit evidence, and proof.
- **Party Visibility Proof**: inspect which templates each party can see at the current offset.

The UI is cyberpunk-terminal styled, but the information architecture is practical: current state first, command next, evidence underneath.

## Architecture

```text
Browser
  |
  | Next.js UI
  v
Next.js API routes
  |
  | signed demo session + role-scoped command routing
  v
Next.js workflow service
  |
  | CANTON_JSON_API_URL
  v
Canton JSON Ledger API
  |
  v
Daml contracts in contracts/daml/CollateralOps.daml
```

Main parts:

- `src/app/page.tsx`: command-center UI.
- `src/lib/canton-client.ts`: Canton JSON API client, workflow actions, party-scoped mapping, and collateral recommendation logic.
- `src/lib/demo-session.ts`: signed demo session and workflow-context cookies for Vercel-safe previews.
- `src/app/api/workflow/*`: server routes for snapshots, actions, bootstrap, and recommendations.
- `src/app/api/demo/*`: access-key session and reset routes.
- `contracts/daml/CollateralOps.daml`: Daml templates and workflow scripts.
- `scripts/canton-json-proof.sh`: end-to-end HTTP proof through the app API.
- `Dockerfile.canton` and `render/*`: Render preview backend for the Canton sandbox JSON API.

## Daml Model

Core templates:

- `TreasuryPosition`: tokenized UST position, investor, custodian, auditor, market value, haircut, eligibility, maturity, liquidity tier, and risk notes.
- `MarginCall`: secured-party call against an investor, required value, exposure, minimum haircut, due date, and reason.
- `ExposureTerms`: bilateral private terms visible only to the secured party and investor.
- `CollateralOffer`: investor offer of a specific Treasury position.
- `LockedCollateral`: custodian proof that the pledged asset is locked.
- `ActivePledge`: secured-party accepted pledge.
- `PledgeCloseout`: final release or seizure record.

Important choices:

- `OfferCollateral`
- `LockByCustodian`
- `AcceptPledge`
- `ReleaseCollateral`
- `SeizeCollateral`

## API Routes

```text
GET  /api/status
POST /api/demo/session
POST /api/demo/reset
GET  /api/workflow/snapshot?party=investor
POST /api/workflow/bootstrap
POST /api/workflow/action
POST /api/workflow/recommend
```

Supported workflow actions:

```text
bootstrap
offer
lock
accept
release
default
```

`default` exercises the Daml `SeizeCollateral` closeout path.

`bootstrap` accepts an optional scenario:

```json
{ "scenario": "standard" }
```

Supported scenarios:

```text
standard
default-risk
undercovered
```

If `DEMO_ACCESS_KEY` is configured, workflow-changing routes require a valid demo session cookie from `/api/demo/session`.

The app also signs the workflow context into an HttpOnly cookie. That keeps the hackathon preview usable on Vercel serverless functions without adding a database: parties, active ledger offset, scenario, and last action can survive refreshes and function cold starts.

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

Start a Canton sandbox with JSON API:

```bash
cd contracts
dpm sandbox --json-api-port 7575 --dar .daml/dist/collateralops-0.1.0.dar
```

In another shell, start the web app:

```bash
CANTON_JSON_API_URL=http://localhost:7575 pnpm dev
```

Open:

```text
http://localhost:3000
```

If `CANTON_JSON_API_URL` is missing, the app shows a setup error instead of pretending to run.

## Prove The Workflow

Run the normal release path:

```bash
CANTON_JSON_API_URL=http://localhost:7575 ./scripts/canton-json-proof.sh
```

Run the default/seizure path:

```bash
CLOSEOUT_ACTION=default CANTON_JSON_API_URL=http://localhost:7575 ./scripts/canton-json-proof.sh
```

Run the fallback-collateral scenario:

```bash
SCENARIO=undercovered CANTON_JSON_API_URL=http://localhost:7575 ./scripts/canton-json-proof.sh
```

If the live preview is protected:

```bash
DEMO_ACCESS_KEY=your-key APP_URL=https://your-app.example ./scripts/canton-json-proof.sh
```

The proof script:

- Checks the Canton JSON API health endpoint.
- Bootstraps parties and initial contracts.
- Opens a demo session and preserves the session cookie.
- Requests an investor-scoped collateral recommendation.
- Drives offer, lock, accept, and closeout through the app API.
- Prints party-scoped snapshots for investor, secured party, custodian, and auditor.

## Live Deployment

Recommended hackathon preview deployment:

```text
Vercel
  Next.js product UI and API routes

Render
  Docker service running the Canton sandbox JSON API

GitHub Actions
  Scheduled keep-awake ping for the Render preview backend
```

Deployment files:

```text
Dockerfile.canton
render.yaml
render/start-canton.sh
render/canton-proxy.mjs
.github/workflows/keep-render-awake.yml
```

Vercel environment variables:

```bash
CANTON_JSON_API_URL=https://your-render-service.onrender.com
DEMO_ACCESS_KEY=your-demo-key
DEMO_SESSION_SECRET=your-long-random-secret
CANTON_HEALTH_TIMEOUT_MS=8000
CANTON_REQUEST_TIMEOUT_MS=25000
```

GitHub Actions keep-awake secret:

```bash
RENDER_KEEPALIVE_URL=https://your-render-service.onrender.com
```

The UI shows a Canton backend warming notice if the Render service is asleep or slow to respond.

Full deployment runbook: [LIVE_PRODUCT_GUIDE.md](./LIVE_PRODUCT_GUIDE.md).

## Verification

Current verification commands:

```bash
pnpm check
cd contracts && dpm build && dpm test
```

The recommendation engine has focused unit coverage in `src/lib/canton-client.test.ts`.

## Product Status

This is a working product prototype with a real Canton JSON API path. It is not a production collateral system yet.

What is real now:

- Daml contract model.
- Canton sandbox execution.
- JSON Ledger API submissions.
- Party-scoped active-contract queries.
- Deterministic lowest-surplus collateral recommendation with rejected-asset reasons.
- Private bilateral exposure terms hidden from non-participants.
- Demo-session isolation and protected mutating routes when `DEMO_ACCESS_KEY` is set.
- Signed workflow-context cookies for Vercel-safe live previews.
- Render Docker wrapper and GitHub Actions keep-awake workflow for the Canton preview backend.
- Release and default closeout paths.
- Operator-facing UI.

What still needs production hardening:

- Authentication and role-bound sessions.
- A hosted Canton participant or managed deployment.
- Durable database for workflow metadata and audit history.
- Monitoring, logs, and operational runbooks.
- Real asset/token integration beyond the modeled Treasury position.

## Environment

```bash
CANTON_JSON_API_URL=http://localhost:7575
DEMO_ACCESS_KEY=optional-demo-key
DEMO_SESSION_SECRET=optional-long-random-secret
```
