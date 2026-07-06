# Live Product Guide

This is the deployment path for the hackathon preview.

```text
Vercel
  Next.js product UI and API routes

Your local machine (or any 1GB+ RAM server)
  Canton sandbox JSON API → exposed via Cloudflare Tunnel / ngrok
```

Render's free tier (512MB) can't run Canton — it OOMs. Self-hosted Canton + Vercel UI is the recommended approach.

The app is still a product preview, not production collateral infrastructure. The goal is to give judges a stable live link that proves the Canton workflow end to end.

## What Ships Where

### Vercel

Use Vercel for:

- the Next.js app
- server-rendered product pages
- API routes under `/api/*`
- signed demo-session cookies
- access-key protection for mutating routes

Do not use Vercel for the long-running Canton process. Vercel functions are request scoped; Canton needs a long-lived service.

### Self-hosted Canton (local machine / server)

Use your own machine for:

- Canton sandbox JSON Ledger API
- the `/livez` health endpoint consumed by Vercel

Canton needs ~1GB RAM minimum. Any Linux machine with Java 21 will do.

## 1. Prepare The Repo

Run locally before pushing:

```bash
pnpm check
cd contracts && dpm build && dpm test
```

Commit everything.

Do not commit `.env`, `.env.local`, `.next`, `node_modules`.

## 2. Deploy The App To Vercel

Create a new Vercel project from the GitHub repo.

Use:

```text
Framework: Next.js
Install command: pnpm install
Build command: pnpm build
Output directory: default
```

Set Vercel environment variables:

```text
CANTON_JSON_API_URL=https://your-tunnel-url
DEMO_ACCESS_KEY=demo
DEMO_SESSION_SECRET=choose-a-long-random-secret
LLM_API_KEY=sk-your-dgrid-key         ← optional
LLM_MODEL=openai/gpt-4o
CANTON_HEALTH_TIMEOUT_MS=8000
CANTON_REQUEST_TIMEOUT_MS=25000
```

`CANTON_JSON_API_URL` should point to your tunnel URL (see step 4). You'll update this after creating the tunnel.

## 3. Start Canton Sandbox Locally

```bash
pnpm dev:canton
# or manually:
export JAVA_HOME=/path/to/jdk-21
export PATH="/home/you/.dpm/bin:$JAVA_HOME/bin:$PATH"
cd contracts && dpm build && dpm sandbox --json-api-port 7575 --dar .daml/dist/collateralops-0.1.0.dar
```

Verify:

```bash
curl -fsS http://localhost:7575/livez
```

Expected: HTTP 200 with empty body.

## 4. Create A Tunnel

Pick one:

**Cloudflare Tunnel** (free, needs `cloudflared`):
```bash
cloudflared tunnel --url http://localhost:7575
# → https://radiant-topic-gb.trycloudflare.com
```

**ngrok** (free, needs `ngrok` account):
```bash
ngrok http 7575
# → https://xxxx-71-19-2.ngrok-free.app
```

**localtunnel** (free, no account):
```bash
npx localtunnel --port 7575
# → https://xxxx.loca.lt
```

Copy the tunnel URL. Go into Vercel project settings → Environment Variables → Update `CANTON_JSON_API_URL` to the tunnel URL → Redeploy.

## 5. Verify

```bash
curl -fsS https://YOUR-VERCEL-APP.vercel.app/api/status
# → {"mode":"canton-json-api","healthy":true,...}
```

Visit the app, enter demo access key `demo`, and run the weekend-stress scenario.

## 6. Judge Demo Flow

1. Open the Vercel URL.
2. If the header says Canton unavailable, check your tunnel and local sandbox.
3. Enter the demo access key when prompted (`demo`).
4. Choose `Weekend Stress`.
5. Start workflow.
6. Show the recommendation panel.
7. Drive offer → lock → **settle (atomic DvP)** → release.
8. Open Technical Proof and Party Proof Matrix.
9. Switch to auditor — show the CantSeePanel and "Cash leg: Hidden" in proof matrix.
10. Click "Ask agent to decide next step."

## 7. Failure Handling

### Vercel says Canton unavailable

Check that your local Canton sandbox and tunnel are running:

```bash
curl -i https://YOUR-TUNNEL-URL/livez
curl -i https://YOUR-VERCEL-APP.vercel.app/api/status
```

If your machine sleeps or the tunnel disconnects, the app shows "Canton backend is not ready yet."

### Workflow resets after refresh

This is fixed by signed workflow-context cookies. Check that Vercel has:

```text
DEMO_SESSION_SECRET
```

If that secret changes between deployments, old demo cookies become invalid and users should open a new demo session.

## 8. Production Caveats

Do not claim this is production-ready.

Still needed for a real pilot:

- real authentication
- role-bound users
- durable database for sessions and workflow metadata
- managed Canton participant/synchronizer setup
- private network access to Canton
- monitoring and alerting
- operational runbooks
- customer-specific environment isolation

Accurate public positioning:

```text
CollateralOps is a live Canton-backed product preview for private tokenized Treasury collateral workflows.
```

## Useful Links

- Vercel Next.js deployments: https://vercel.com/docs/frameworks/nextjs
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps
- ngrok: https://ngrok.com
