import { CheckCircle2, Eye, LockKeyhole, Terminal } from "lucide-react";
import { checkCantonHealth, getSnapshot } from "@/lib/canton-client";
import { usd, shortTime } from "@/lib/format";
import type { ContractKind, PartyRole, WorkflowContract, WorkflowSnapshot } from "@/lib/types";
import { WorkflowControls } from "./workflow-controls";

const roles: PartyRole[] = ["investor", "securedParty", "custodian", "auditor"];

const roleCopy: Record<PartyRole, { name: string; description: string }> = {
  investor: {
    name: "Investor",
    description: "Owns the tokenized Treasury position and answers margin calls.",
  },
  securedParty: {
    name: "Secured Party",
    description: "Requests collateral, accepts the pledge, then releases or seizes it.",
  },
  custodian: {
    name: "Custodian",
    description: "Locks the pledged asset and proves the position is encumbered.",
  },
  auditor: {
    name: "Auditor",
    description: "Observes the workflow without seeing every private contract.",
  },
};

const stageCopy: Record<string, { label: string; summary: string; next: string }> = {
  "call-open": {
    label: "Margin call open",
    summary: "NorthBank has raised a private collateral requirement against AtlasFund.",
    next: "Investor posts tokenized UST collateral.",
  },
  "offer-posted": {
    label: "Collateral offered",
    summary: "AtlasFund selected a Treasury position and offered it into the pledge workflow.",
    next: "Custodian locks the asset so it cannot be reused elsewhere.",
  },
  "collateral-locked": {
    label: "Custody lock active",
    summary: "ClearVault marked the Treasury position as encumbered on Canton.",
    next: "Secured party accepts the locked collateral as an active pledge.",
  },
  "pledge-active": {
    label: "Pledge active",
    summary: "The collateral pledge is live and visible only to the parties allowed by the Daml model.",
    next: "Secured party releases collateral when exposure normalizes, or seizes after default.",
  },
  released: {
    label: "Collateral released",
    summary: "The pledge was closed and the Treasury position is no longer encumbered.",
    next: "Bootstrap a fresh workflow to run the Canton sequence again.",
  },
  seized: {
    label: "Collateral seized",
    summary: "The pledge was closed by seizure after the secured party exercised its closeout right.",
    next: "Bootstrap a fresh workflow to run another scenario.",
  },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ party?: PartyRole }>;
}) {
  const params = await searchParams;
  const activeParty = roles.includes(params.party as PartyRole) ? (params.party as PartyRole) : "investor";
  const [snapshotResult, health] = await Promise.allSettled([getSnapshot(activeParty), checkCantonHealth()]);

  if (snapshotResult.status === "rejected") {
    return (
      <main className="terminal-shell">
        <header className="topbar">
          <div className="brand">
            <Terminal size={18} />
            <div>
              <strong>CollateralOps Terminal</strong>
              <span>Canton connection required</span>
            </div>
          </div>
          <div className="status-strip">
            <Pill label="ledger" value="canton-json-api" tone="danger" />
            <Pill label="health" value="offline" tone="danger" />
          </div>
        </header>
        <section className="connection-required">
          <h1>Connect Canton to run this app</h1>
          <p>{snapshotResult.reason instanceof Error ? snapshotResult.reason.message : "Canton JSON Ledger API is required."}</p>
          <pre>{`export JAVA_HOME=/home/kiter/.local/jdk-current
export PATH="/home/kiter/.dpm/bin:$JAVA_HOME/bin:$PATH"
cd contracts && dpm build
dpm sandbox --json-api-port 7575 --dar .daml/dist/collateralops-0.1.0.dar
CANTON_JSON_API_URL=http://localhost:7575 pnpm dev`}</pre>
        </section>
      </main>
    );
  }

  const snapshot = snapshotResult.value;
  const hasLiveWorkflow = snapshot.contracts.length > 0 || snapshot.receipts.length > 0;
  const isFreshStart = !hasLiveWorkflow && snapshot.nextActions.length === 1 && snapshot.nextActions[0] === "bootstrap";
  const currentStage = isFreshStart
    ? {
        label: "Ready to start",
        summary: "No active CollateralOps workflow is loaded in this app process yet.",
        next: "Submit Start Fresh Canton Workflow to allocate parties and create the first TreasuryPosition + MarginCall contracts.",
      }
    : stageCopy[snapshot.stage] ?? {
        label: snapshot.stage,
        summary: "Current state is loaded from the Canton active-contract set.",
        next: "Use the available action to submit the next Canton command.",
      };
  const healthValue =
    health.status === "fulfilled"
      ? health.value
      : { healthy: false, message: health.reason instanceof Error ? health.reason.message : "Canton health check failed." };

  return (
    <main className="terminal-shell">
      <header className="topbar">
        <div className="brand">
          <Terminal size={18} />
          <div>
            <strong>CollateralOps Terminal</strong>
            <span>private margin call + tokenized Treasury pledge workflow</span>
          </div>
        </div>
        <div className="status-strip">
          <Pill label="ledger" value={snapshot.mode} tone="ok" />
          <Pill label="health" value={healthValue.healthy ? "ready" : "offline"} tone={healthValue.healthy ? "ok" : "danger"} />
          <Pill label="stage" value={snapshot.stage} tone="info" />
          <Pill label="submission" value="2026-07-13 11:59 UTC" tone="info" />
        </div>
      </header>

      <section className="workspace">
        <aside className="rail">
          <div className="rail-section">
            <span className="rail-title">1. Choose Party View</span>
            {roles.map((role) => (
              <a className={role === activeParty ? "role active" : "role"} href={`/?party=${role}`} key={role}>
                <span>{roleCopy[role].name}</span>
                <em>{roleCopy[role].description}</em>
                <small title={snapshot.parties[role]}>{snapshot.parties[role]}</small>
              </a>
            ))}
          </div>

          <div className="rail-section">
            <span className="rail-title">2. What This Party Can See</span>
            {Object.entries(snapshot.visibility).map(([kind, visible]) => (
              <div className="visibility-row" key={kind}>
                <span>{kind}</span>
                <strong className={visible ? "visible" : "hidden"}>{visible ? "visible" : "hidden"}</strong>
              </div>
            ))}
          </div>
        </aside>

        <section className="main-grid">
          <Panel title="Current Canton State" eyebrow="what is happening now" wide>
            <div className="explainer">
              <div>
                <span className="step-label">Current step</span>
                <h1>{currentStage.label}</h1>
                <p>{currentStage.summary}</p>
              </div>
              <div className="next-box">
                <span>Next ledger action</span>
                <strong>{currentStage.next}</strong>
              </div>
            </div>
            <div className="mini-guide">
              <GuideItem icon={<LockKeyhole size={16} />} title="Private contracts" text="Each tab queries the same Canton workflow through a different party." />
              <GuideItem icon={<Eye size={16} />} title="Visibility changes" text="Hidden rows mean this party is not entitled to see that contract." />
              <GuideItem icon={<CheckCircle2 size={16} />} title="Buttons submit commands" text="Actions below the graph are real JSON API submissions to the sandbox." />
            </div>
          </Panel>

          <Panel title="3. Submit Next Canton Command" eyebrow="guided workflow">
            <WorkflowGraph stage={snapshot.stage} started={!isFreshStart} />
            <WorkflowControls actions={snapshot.nextActions} activeParty={activeParty} stage={snapshot.stage} />
          </Panel>

          <Panel title="Margin Call Blotter" eyebrow="secured exposure">
            {contractsOf(snapshot.contracts, "MarginCall").length === 0 ? (
              <EmptyState text={`${roleCopy[activeParty].name} cannot currently see the private MarginCall contract.`} />
            ) : contractsOf(snapshot.contracts, "MarginCall").map((contract) => (
              <div className="call-card" key={contract.id}>
                <div>
                  <strong>{contract.id}</strong>
                  <p>{contract.reason}</p>
                </div>
                <div className="metric-row">
                  <Metric label="Required" value={usd(contract.requiredValue)} />
                  <Metric label="Due" value={shortTime(contract.dueDate)} />
                  <Metric label="Status" value={contract.status} />
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="Tokenized UST Inventory" eyebrow="investor + custodian">
            <div className="table">
              <div className="table-head">
                <span>CUSIP</span>
                <span>Market Value</span>
                <span>Haircut</span>
                <span>State</span>
              </div>
              {contractsOf(snapshot.contracts, "TreasuryPosition").length === 0 ? (
                <div className="table-empty">This party cannot see the TreasuryPosition contract.</div>
              ) : contractsOf(snapshot.contracts, "TreasuryPosition").map((contract) => (
                <div className="table-row" key={contract.id}>
                  <span>{contract.cusip}</span>
                  <span>{usd(contract.marketValue)}</span>
                  <span>{contract.haircutPct}%</span>
                  <span className="state">{contract.encumbrance}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Audit Evidence Feed" eyebrow="restricted observer trail">
            <div className="feed">
              {snapshot.receipts.length === 0 ? (
                <EmptyState text="No audit receipt is visible to this party yet." />
              ) : snapshot.receipts.map((receipt) => (
                <article className="receipt" key={receipt.id}>
                  <span>{shortTime(receipt.timestamp)}</span>
                  <strong>{receipt.action} · {receipt.actor}</strong>
                  <p>{receipt.summary}</p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="Active Contracts" eyebrow="party-scoped ledger view" wide>
            <div className="contract-grid">
              {snapshot.contracts.length === 0 ? (
                <EmptyState text="This party has no visible active contracts at the current ledger offset." />
              ) : snapshot.contracts.map((contract) => (
                <pre className="contract" key={contract.id}>
                  {JSON.stringify(contract, null, 2)}
                </pre>
              ))}
            </div>
          </Panel>
        </section>
      </section>
    </main>
  );
}

function GuideItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="guide-item">
      {icon}
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  children,
  wide = false,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={wide ? "panel wide" : "panel"}>
      <div className="panel-title">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Pill({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "danger" | "info" }) {
  return (
    <div className={`pill ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function WorkflowGraph({ stage, started }: { stage: string; started: boolean }) {
  const nodes = [
    ["call-open", "Margin Call"],
    ["offer-posted", "Offer"],
    ["collateral-locked", "Custody Lock"],
    ["pledge-active", "Accepted Pledge"],
    ["released", "Release"],
  ];

  const activeIndex = started ? Math.max(0, nodes.findIndex(([key]) => key === stage)) : -1;

  return (
    <div className="flow">
      {nodes.map(([key, label], index) => (
        <div className={index <= activeIndex ? "flow-node active" : "flow-node"} key={key}>
          <span>{index + 1}</span>
          <strong>{label}</strong>
        </div>
      ))}
    </div>
  );
}

function contractsOf<T extends ContractKind>(contracts: WorkflowContract[], kind: T) {
  return contracts.filter((contract) => contract.kind === kind) as Extract<WorkflowContract, { kind: T }>[];
}
