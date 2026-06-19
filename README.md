# CollateralOps Command Center

CollateralOps Command Center is a Canton-native MVP for the Encode Build on Canton Hackathon. It is a private collateral mobility terminal for institutional tokenized Treasury workflows: an investor receives a repo margin call, the app recommends eligible UST collateral, a custodian locks the asset, a secured party accepts the pledge, and an auditor sees restricted evidence without global state leakage.

## Why This Belongs On Canton

- Multi-party workflow: investor, secured party, custodian, and auditor each have distinct authority.
- Privacy: each party sees the contracts it is entitled to see, not a public global order book.
- Atomicity: offer, lock, accept, release, and default closeout are explicit state transitions.
- Institutional relevance: collateral mobility, tokenized Treasuries, margin calls, and audit trails are real operational problems.
- Product fit: Canton turns private multi-party settlement into an operator workflow rather than exposing a generic dashboard.

## Run The Web App

```bash
pnpm install
CANTON_JSON_API_URL=http://localhost:7575 pnpm dev
```

Open `http://localhost:3000`.

`CANTON_JSON_API_URL` is required. The app does not run a local demo ledger; it reads and advances workflow state through Canton JSON Ledger API.

## Canton Proof Path

Install the Canton/Daml toolchain first. This workspace currently assumes:

- `dpm` available on PATH
- Canton JSON Ledger API available at `http://localhost:7575`

Build the Daml archive:

```bash
cd contracts
dpm build
dpm test
```

Start a local sandbox with JSON API:

```bash
dpm sandbox --json-api-port 7575 --dar .daml/dist/collateralops-0.1.0.dar
```

In another shell from the repo root:

```bash
CANTON_JSON_API_URL=http://localhost:7575 pnpm dev
```

Then run the proof:

```bash
CANTON_JSON_API_URL=http://localhost:7575 ./scripts/canton-json-proof.sh
```

To prove the default/seizure path instead of release:

```bash
CLOSEOUT_ACTION=default CANTON_JSON_API_URL=http://localhost:7575 ./scripts/canton-json-proof.sh
```

## Environment

```bash
CANTON_JSON_API_URL=http://localhost:7575
```

If unset, the terminal shows a Canton connection error and setup commands.
