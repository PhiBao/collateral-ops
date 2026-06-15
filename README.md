# CollateralOps Terminal

CollateralOps Terminal is a Canton-native MVP for the Encode Build on Canton Hackathon. It models a private institutional margin-call workflow where an investor pledges tokenized U.S. Treasury collateral, a custodian locks it, a secured party accepts it, and an auditor sees the required evidence without global state leakage.

## Why This Belongs On Canton

- Multi-party workflow: investor, secured party, custodian, and auditor each have distinct authority.
- Privacy: each party sees the contracts it is entitled to see, not a public global order book.
- Atomicity: offer, lock, accept, release, and seize are explicit state transitions.
- Institutional relevance: margin calls, collateral mobility, tokenized assets, and audit trails are real operational problems.

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

## Demo Script Under 3 Minutes

1. Show the terminal in `investor` view: UST inventory and open private margin call.
2. Click `offer`: AtlasFund pledges tokenized UST collateral.
3. Switch to `custodian`: ClearVault sees the offer and locks collateral.
4. Switch to `securedParty`: NorthBank accepts the pledge and cures the call.
5. Switch to `auditor`: RegSight sees the evidence trail, not an unrestricted global ledger.
6. Close with the Daml model and Canton proof commands.

## Submission Checklist

- Public repository
- Live product link
- Presentation deck
- 3-minute pitch/demo video
- README proof path with local Canton commands

## Environment

```bash
CANTON_JSON_API_URL=http://localhost:7575
```

If unset, the terminal shows a Canton connection error and setup commands.
