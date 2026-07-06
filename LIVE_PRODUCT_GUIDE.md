# Live Product Guide

This is the deployment path for the hackathon preview:

```text
Vercel
  Next.js product UI and API routes

Render
  Docker web service running the Canton sandbox JSON API

GitHub Actions
  Scheduled keep-awake ping for the Render preview backend
```

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

### Render

Use Render for:

- the Docker service defined by `Dockerfile.canton`
- the Canton sandbox JSON Ledger API
- the `/livez` health endpoint consumed by Vercel

The Render service is a preview backend. Free Render instances can sleep after inactivity, so the UI includes a backend-waking notice and the repo includes a scheduled keep-awake workflow.

## Files Added For Deployment

```text
Dockerfile.canton
render.yaml
render/start-canton.sh
render/canton-proxy.mjs
.github/workflows/keep-render-awake.yml
```

The Render service starts Canton on an internal port and exposes Render's required `$PORT` through a small Node HTTP proxy. This avoids depending on Canton binding directly to Render's web-service port.

## 1. Prepare The Repo

Run locally before pushing:

```bash
pnpm check
cd contracts && dpm build && dpm test
```

Commit the deployment files, app code, Daml contracts, and guides.

Do not commit `.env`, `.env.local`, `.next`, `node_modules`, or `contracts/.daml`.

## 2. Deploy The Canton Backend To Render

Recommended: create a new Render Blueprint from `render.yaml`.

Manual equivalent:

```text
Service type: Web Service
Runtime: Docker
Dockerfile path: ./Dockerfile.canton
Health check path: /livez
Plan: free for preview, paid if you need fewer cold starts
```

Render environment variables:

```text
CANTON_JSON_PORT=7575
```

Render injects `PORT`. Do not set `PORT` manually unless Render asks you to.

After deployment, verify:

```bash
curl -fsS https://YOUR-RENDER-SERVICE.onrender.com/livez
```

Expected result: HTTP 200 with an empty body from Canton once the sandbox is ready. During cold start, the proxy may return a temporary JSON `503` saying Canton is starting.

If the Render build fails because the Daml installer provides `daml` but not `dpm`, use the fallback in `Dockerfile.canton`: it already tries `dpm build` first and then `daml build`. If both are missing, install a pinned DPM-capable image/cache before the `cd contracts && ... build` step.

## 3. Deploy The App To Vercel

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
CANTON_JSON_API_URL=https://YOUR-RENDER-SERVICE.onrender.com
DEMO_ACCESS_KEY=choose-a-short-demo-key
DEMO_SESSION_SECRET=choose-a-long-random-secret
CANTON_HEALTH_TIMEOUT_MS=8000
CANTON_REQUEST_TIMEOUT_MS=25000
```

`DEMO_ACCESS_KEY` protects workflow-changing routes. `DEMO_SESSION_SECRET` signs session and workflow-context cookies so Vercel can resume a demo across serverless requests.

Deploy, then verify:

```bash
curl -fsS https://YOUR-VERCEL-APP.vercel.app/api/status
```

## 4. Configure Keep-Awake

GitHub Actions workflow:

```text
.github/workflows/keep-render-awake.yml
```

Add this GitHub secret:

```text
RENDER_KEEPALIVE_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

The workflow pings:

```text
https://YOUR-RENDER-SERVICE.onrender.com/livez
```

Schedule:

```text
*/10 * * * *
```

That is intentionally below Render's free-instance idle window. GitHub scheduled workflows are not real-time infrastructure, so still expect occasional cold starts. The UI handles this with a Canton backend warming notice.

## 5. Run The Remote Proof

Standard release path:

```bash
APP_URL=https://YOUR-VERCEL-APP.vercel.app \
CANTON_JSON_API_URL=https://YOUR-RENDER-SERVICE.onrender.com \
DEMO_ACCESS_KEY=choose-a-short-demo-key \
./scripts/canton-json-proof.sh
```

Fallback-collateral scenario:

```bash
SCENARIO=undercovered \
APP_URL=https://YOUR-VERCEL-APP.vercel.app \
CANTON_JSON_API_URL=https://YOUR-RENDER-SERVICE.onrender.com \
DEMO_ACCESS_KEY=choose-a-short-demo-key \
./scripts/canton-json-proof.sh
```

Default/seizure path:

```bash
CLOSEOUT_ACTION=default \
APP_URL=https://YOUR-VERCEL-APP.vercel.app \
CANTON_JSON_API_URL=https://YOUR-RENDER-SERVICE.onrender.com \
DEMO_ACCESS_KEY=choose-a-short-demo-key \
./scripts/canton-json-proof.sh
```

What to confirm in the output:

- `stage":"released"` appears in the release path.
- `scenario":"undercovered"` appears in the fallback run.
- rejected recommendations include `rejectionReasons`.
- `stage":"seized"` or `finalStatus":"seized"` appears in the default run.
- party visibility marks `ExposureTerms` visible to investor/secured party and hidden from custodian/auditor.

## 6. Judge Demo Flow

1. Open the Vercel URL.
2. If the header says Canton unavailable, wait for the Render backend warming notice to clear and click `Retry connection`.
3. Enter the demo access key when prompted.
4. Choose `Fallback` if you want the strongest product story.
5. Start workflow.
6. Show the recommendation panel rejecting three assets and selecting the fallback Treasury.
7. Drive offer, lock, accept, and release/default.
8. Open Technical Proof and Party Proof Matrix.

## 7. Failure Handling

### Vercel says Canton unavailable

Check:

```bash
curl -i https://YOUR-RENDER-SERVICE.onrender.com/livez
curl -i https://YOUR-VERCEL-APP.vercel.app/api/status
```

If Render is cold, the first request may wake it. Wait 30-90 seconds and retry.

### Workflow resets after refresh

This should be fixed by signed workflow-context cookies. Check that Vercel has:

```text
DEMO_SESSION_SECRET
```

If that secret changes between deployments, old demo cookies become invalid and users should open a new demo session.

### Mutation routes are public

Set:

```text
DEMO_ACCESS_KEY
```

Then verify unauthenticated mutation fails:

```bash
curl -i -X POST https://YOUR-VERCEL-APP.vercel.app/api/workflow/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"scenario":"standard"}'
```

Expected: `401 demo_session_required`.

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
- Render web services: https://render.com/docs/web-services
- Render Docker services: https://render.com/docs/docker
- Render free instance behavior: https://render.com/docs/free
- GitHub scheduled workflows: https://docs.github.com/actions/using-workflows/events-that-trigger-workflows#schedule
