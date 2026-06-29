import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  Landmark,
  LockKeyhole,
  Radio,
  ShieldCheck,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { cookies } from "next/headers";
import { checkCantonHealth, getSnapshot } from "@/lib/canton-client";
import {
  demoSessionCookieName,
  previewSessionId,
  readDemoSessionIdFromCookieValue,
  readWorkflowSessionStateFromCookieValue,
  workflowContextCookieName,
} from "@/lib/demo-session";
import { shortTime, usd } from "@/lib/format";
import {
  buildWorkflowViewModel,
  roleCopy,
  roleOrder,
  visibilityLabels,
  workflowSteps,
} from "@/lib/workflow-view-model";
import type { ContractKind, PartyRole, WorkflowContract, WorkflowSnapshot } from "@/lib/types";
import { WorkflowControls } from "./workflow-controls";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ party?: PartyRole }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const sessionId = readDemoSessionIdFromCookieValue(cookieStore.get(demoSessionCookieName)?.value) ?? previewSessionId();
  const persistedContext = readWorkflowSessionStateFromCookieValue(cookieStore.get(workflowContextCookieName)?.value, sessionId);
  const activeParty = roleOrder.includes(params.party as PartyRole) ? (params.party as PartyRole) : "investor";
  const [snapshotResult, health] = await Promise.allSettled([
    getSnapshot(activeParty, sessionId, persistedContext),
    checkCantonHealth(),
  ]);

  if (snapshotResult.status === "rejected") {
    return <OfflineExperience reason={snapshotResult.reason} />;
  }

  const snapshot = snapshotResult.value;
  const model = buildWorkflowViewModel(snapshot);
  const healthValue =
    health.status === "fulfilled"
      ? health.value
      : { healthy: false, message: health.reason instanceof Error ? health.reason.message : "Canton health check failed." };

  return (
    <main className="app-shell">
      <AppHeader
        healthLabel={healthValue.healthy ? "Live Canton connection" : "Canton unavailable"}
        healthTone={healthValue.healthy ? "ok" : "danger"}
        stageLabel={model.stageLabel}
        scenarioLabel={model.scenarioLabel}
      />

      <section className="hero-band">
        <div className="container hero-layout">
          <div className="hero-copy">
            <div className="status-line">
              <span>{model.stageLabel}</span>
              <span>{model.proofStatus}</span>
            </div>
            <h1>{model.headline}</h1>
            <p>{model.summary}</p>
          </div>

          <aside className="next-action-panel" aria-label="Next action">
            <span>Next best action</span>
            <strong>{model.primaryIntent}</strong>
            <p>{model.nextActionSummary}</p>
            <div className="assignment-row">
              <small>Assigned to</small>
              <b>{model.nextActorName}</b>
            </div>
          </aside>
        </div>
      </section>

      {!healthValue.healthy ? <BackendWakeNotice message={healthValue.message} /> : null}

      <section className="role-band">
        <div className="container role-layout">
          <div>
            <span className="section-label">Viewing as</span>
            <h2>{model.activeRoleName}</h2>
            <p>{roleCopy[model.activeParty].description}</p>
          </div>
          <nav className="role-switcher" aria-label="Party view">
            {roleOrder.map((role) => (
              <a className={role === activeParty ? "role-tab active" : "role-tab"} href={`/?party=${role}`} key={role}>
                <span>{roleCopy[role].name}</span>
                <small title={snapshot.parties[role]}>{snapshot.parties[role]}</small>
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section className="container metric-strip" aria-label="Workflow metrics">
        <MetricCard label="Required collateral" value={model.requiredValue} helper="Minimum post-haircut value" />
        <MetricCard label="Exposure" value={model.exposureValue} helper="Private secured-party call" />
        <MetricCard label="Recommended coverage" value={model.recommendedCoverage} helper={model.recommendedCusip} />
        <MetricCard label="Due" value={model.dueAt} helper="UTC workflow deadline" />
      </section>

      <section className="container operation-grid">
        <section className="surface action-surface">
          <SectionHeading
            icon={<ClipboardCheck size={18} />}
            title="Resolve The Call"
            text={`Current view: ${model.activeRoleName}. Commands submit to Canton and refresh the party-scoped view.`}
          />
          <WorkflowControls actions={snapshot.nextActions} activeParty={activeParty} stage={snapshot.stage} />
        </section>

        <section className="surface recommendation-surface">
          <SectionHeading
            icon={<WalletCards size={18} />}
            title="Collateral Recommendation"
            text="The app selects the eligible Treasury position with the smallest sufficient post-haircut surplus."
          />
          <RecommendationList snapshot={snapshot} activeParty={activeParty} />
        </section>

        <section className="surface timeline-surface">
          <SectionHeading
            icon={<ShieldCheck size={18} />}
            title="Private Handoff Timeline"
            text="Each step has a different controller, so the workflow reads like operations rather than a ledger console."
          />
          <WorkflowTimeline snapshot={snapshot} started={!model.isFreshStart} />
        </section>

        <section className="surface privacy-surface">
          <SectionHeading
            icon={<Eye size={18} />}
            title="Party Privacy View"
            text="The visible evidence changes by party, while the workflow state remains shared."
          />
          <PrivacyMatrix visibility={snapshot.visibility} />
        </section>

        <section className="surface call-surface">
          <SectionHeading
            icon={<Landmark size={18} />}
            title="Margin Call Brief"
            text="A finance operator gets the reason, requirement, haircut, and due time without reading raw contract JSON."
          />
          <MarginCallBrief snapshot={snapshot} activeParty={activeParty} />
        </section>

        <section className="surface inventory-surface">
          <SectionHeading
            icon={<LockKeyhole size={18} />}
            title="Tokenized Treasury Inventory"
            text="The asset state shows whether collateral is free, offered, locked, pledged, released, or seized."
          />
          <Inventory snapshot={snapshot} activeParty={activeParty} />
        </section>

        <section className="surface evidence-surface">
          <SectionHeading
            icon={<FileText size={18} />}
            title="Audit Evidence"
            text="Receipts are readable first, with offsets and templates available for proof."
          />
          <EvidenceFeed snapshot={snapshot} activeParty={activeParty} />
        </section>

        <section className="surface proof-surface">
          <SectionHeading
            icon={<Radio size={18} />}
            title="Technical Proof"
            text="Reviewer-facing Canton details stay available without taking over the product workflow."
          />
          <ProofDrawer snapshot={snapshot} />
        </section>
      </section>
    </main>
  );
}

function BackendWakeNotice({ message }: { message: string }) {
  return (
    <section className="container backend-wake-notice" aria-live="polite">
      <div>
        <TriangleAlert size={18} aria-hidden="true" />
        <div>
          <strong>Canton backend is not ready yet.</strong>
          <p>{message}</p>
        </div>
      </div>
      <a href="/">Retry connection</a>
    </section>
  );
}

function AppHeader({
  healthLabel,
  healthTone,
  stageLabel,
  scenarioLabel,
}: {
  healthLabel: string;
  healthTone: "ok" | "danger";
  stageLabel: string;
  scenarioLabel?: string;
}) {
  return (
    <header className="app-header">
      <a className="brand-mark" href="/" aria-label="CollateralOps home">
        <span>
          <Landmark size={20} />
        </span>
        <div>
          <strong>CollateralOps</strong>
          <small>Private collateral resolution</small>
        </div>
      </a>
      <div className="header-status">
        <StatusBadge label={healthLabel} tone={healthTone} />
        <StatusBadge label={stageLabel} tone="neutral" />
        {scenarioLabel ? <StatusBadge label={scenarioLabel} tone="neutral" /> : null}
      </div>
    </header>
  );
}

function OfflineExperience({ reason }: { reason: unknown }) {
  return (
    <main className="app-shell offline-shell">
      <AppHeader healthLabel="Canton unavailable" healthTone="danger" stageLabel="Setup required" />
      <section className="hero-band">
        <div className="container offline-layout">
          <div className="hero-copy">
            <div className="status-line">
              <span>Read-only preview</span>
              <span>No live proof</span>
            </div>
            <h1>Connect Canton to run the private collateral workflow.</h1>
            <p>
              CollateralOps needs the Canton JSON Ledger API before it can create parties, submit commands, or display
              live party-scoped evidence.
            </p>
            <div className="offline-error">
              <AlertCircle size={18} />
              <span>{reason instanceof Error ? reason.message : "Canton JSON Ledger API is required."}</span>
            </div>
          </div>

          <aside className="setup-panel" aria-label="Setup commands">
            <span>Setup checklist</span>
            <ol>
              <li>Build the Daml archive.</li>
              <li>Start a local sandbox with JSON API.</li>
              <li>
                Run the Next.js app with <code>CANTON_JSON_API_URL</code> set.
              </li>
            </ol>
            <pre>{`export JAVA_HOME=/home/kiter/.local/jdk-current
export PATH="/home/kiter/.dpm/bin:$JAVA_HOME/bin:$PATH"
cd contracts && dpm build
dpm sandbox --json-api-port 7575 --dar .daml/dist/collateralops-0.1.0.dar
CANTON_JSON_API_URL=http://localhost:7575 pnpm dev`}</pre>
          </aside>
        </div>
      </section>

      <section className="container preview-grid" aria-label="Read-only workflow preview">
        <PreviewStep title="Margin call" text="NorthBank raises a private repo margin requirement against AtlasFund." />
        <PreviewStep title="Recommendation" text="CollateralOps selects the eligible Treasury position with the least excess pledge." />
        <PreviewStep title="Custody lock" text="ClearVault locks the asset so it cannot be reused during the pledge." />
        <PreviewStep title="Audit evidence" text="RegSight sees restricted evidence without a public global ledger view." />
      </section>
    </main>
  );
}

function SectionHeading({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="section-heading">
      <span>{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  );
}

function RecommendationList({ snapshot, activeParty }: { snapshot: WorkflowSnapshot; activeParty: PartyRole }) {
  if (snapshot.recommendations.length === 0) {
    return (
      <EmptyState
        title="Recommendation not visible"
        text={`${roleCopy[activeParty].name} cannot currently see enough call and inventory data for a recommendation.`}
      />
    );
  }

  return (
    <div className="recommendation-list">
      {snapshot.recommendations.map((recommendation) => (
        <article className={recommendation.selectable ? "recommendation-item" : "recommendation-item rejected"} key={recommendation.positionId}>
          <div>
            <span>{recommendation.selectable ? `Rank ${recommendation.rank}` : "Rejected"}</span>
            <strong>{recommendation.cusip}</strong>
          </div>
          <p>{recommendation.rationale}</p>
          <p>{recommendation.selectionReason}</p>
          <div className="mini-metrics">
            <MetricInline label="Pledge amount" value={usd(recommendation.pledgeAmount)} />
            <MetricInline label="Coverage" value={`${Math.round(recommendation.coverageRatio * 100)}%`} />
            <MetricInline label="Surplus" value={usd(Math.max(0, recommendation.surplusValue))} />
          </div>
          {recommendation.rejectionReasons.length > 0 ? (
            <ul className="warning-list">
              {recommendation.rejectionReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function WorkflowTimeline({ snapshot, started }: { snapshot: WorkflowSnapshot; started: boolean }) {
  return (
    <ol className="timeline">
      {workflowSteps(snapshot.stage, started).map((step) => (
        <li className={`timeline-step ${step.state}`} key={step.key}>
          <span aria-hidden="true">{step.state === "complete" ? <CheckCircle2 size={16} /> : null}</span>
          <div>
            <strong>{step.label}</strong>
            <small>{step.actor}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

function PrivacyMatrix({ visibility }: { visibility: Record<ContractKind, boolean> }) {
  return (
    <div className="privacy-list">
      {Object.entries(visibility).map(([kind, visible]) => (
        <div className="privacy-row" key={kind}>
          <span>{visibilityLabels[kind as ContractKind]}</span>
          <strong className={visible ? "visible" : "hidden"}>{visible ? "Visible" : "Hidden"}</strong>
        </div>
      ))}
    </div>
  );
}

function MarginCallBrief({ snapshot, activeParty }: { snapshot: WorkflowSnapshot; activeParty: PartyRole }) {
  const calls = contractsOf(snapshot.contracts, "MarginCall");
  const terms = contractsOf(snapshot.contracts, "ExposureTerms");

  if (calls.length === 0) {
    return (
      <EmptyState
        title="Margin call hidden"
        text={`${roleCopy[activeParty].name} cannot currently see the private MarginCall contract.`}
      />
    );
  }

  return (
    <>
      <div className="brief-list">
        {calls.map((contract) => (
          <article className="brief-item" key={contract.id}>
            <strong>{contract.reason}</strong>
            <div className="mini-metrics four">
              <MetricInline label="Required" value={usd(contract.requiredValue)} />
              <MetricInline label="Exposure" value={usd(contract.counterpartyExposure)} />
              <MetricInline label="Min haircut" value={`${contract.minimumHaircutPct}%`} />
              <MetricInline label="Due" value={shortTime(contract.dueDate)} />
            </div>
          </article>
        ))}
      </div>
      <div className="brief-list terms-list">
        {terms.length > 0 ? (
          terms.map((contract) => (
            <article className="brief-item private-terms" key={contract.id}>
              <strong>Private exposure terms</strong>
              <div className="mini-metrics">
                <MetricInline label="Valuation source" value={contract.valuationSource} />
                <MetricInline label="Dispute window" value={`${contract.disputeWindowHours}h`} />
                <MetricInline label="Closeout threshold" value={`${contract.closeoutThresholdPct}%`} />
              </div>
              <p>{contract.sensitiveNote}</p>
            </article>
          ))
        ) : (
          <EmptyState
            title="Private terms hidden"
            text={`${roleCopy[activeParty].name} cannot see the bilateral exposure terms contract.`}
          />
        )}
      </div>
    </>
  );
}

function Inventory({ snapshot, activeParty }: { snapshot: WorkflowSnapshot; activeParty: PartyRole }) {
  const positions = contractsOf(snapshot.contracts, "TreasuryPosition");

  if (positions.length === 0) {
    return (
      <EmptyState
        title="Inventory hidden"
        text={`${roleCopy[activeParty].name} cannot currently see the TreasuryPosition contract.`}
      />
    );
  }

  return (
    <div className="inventory-list">
      {positions.map((contract) => (
        <article className="inventory-item" key={contract.id}>
          <div>
            <strong>{contract.cusip}</strong>
            <span>{contract.issuer}</span>
          </div>
          <div className="mini-metrics four">
            <MetricInline label="Market value" value={usd(contract.marketValue)} />
            <MetricInline label="Post-haircut" value={usd(contract.postHaircutValue)} />
            <MetricInline label="Haircut" value={`${contract.haircutPct}%`} />
            <MetricInline label="State" value={contract.encumbrance} />
          </div>
          <p className="risk-note">
            <TriangleAlert size={15} />
            <span>
              {contract.liquidityTier} collateral, matures {contract.maturityDate}. {contract.riskNotes}
            </span>
          </p>
        </article>
      ))}
    </div>
  );
}

function EvidenceFeed({ snapshot, activeParty }: { snapshot: WorkflowSnapshot; activeParty: PartyRole }) {
  if (snapshot.receipts.length === 0) {
    return (
      <EmptyState title="No receipt visible" text={`No audit receipt is visible to ${roleCopy[activeParty].name} yet.`} />
    );
  }

  return (
    <div className="feed">
      {snapshot.receipts.map((receipt) => (
        <article className="feed-item" key={receipt.id}>
          <time>{shortTime(receipt.timestamp)}</time>
          <strong>
            {receipt.action} by {roleCopy[receipt.actor].name}
          </strong>
          <p>{receipt.summary}</p>
        </article>
      ))}
    </div>
  );
}

function ProofDrawer({ snapshot }: { snapshot: WorkflowSnapshot }) {
  return (
    <div className="proof-stack">
      <div className="mini-metrics">
        <MetricInline label="Offset" value={snapshot.proof.activeAtOffset ?? "Not bootstrapped"} />
        <MetricInline label="Visible contracts" value={String(snapshot.proof.visibleContractCount)} />
      </div>
      <div className="proof-query">
        <Radio size={15} />
        <span>{snapshot.proof.partyScopedQuery}</span>
      </div>
      <PartyProofMatrix snapshot={snapshot} />
      <details className="proof-disclosure">
        <summary>Canton templates and active contracts</summary>
        <div className="template-list">
          {snapshot.proof.visibleTemplateIds.length === 0 ? (
            <span>No visible Canton templates at this offset.</span>
          ) : (
            snapshot.proof.visibleTemplateIds.map((templateId) => <code key={templateId}>{templateId}</code>)
          )}
        </div>
        <div className="contract-grid">
          {snapshot.contracts.length === 0 ? (
            <EmptyState title="No active contracts" text="This party has no visible active contracts at the current ledger offset." />
          ) : (
            snapshot.contracts.map((contract) => (
              <pre className="contract" key={contract.id}>
                {JSON.stringify(contract, null, 2)}
              </pre>
            ))
          )}
        </div>
      </details>
    </div>
  );
}

function PartyProofMatrix({ snapshot }: { snapshot: WorkflowSnapshot }) {
  return (
    <div className="party-proof-grid" aria-label="Party visibility proof">
      {snapshot.proof.partyVisibility.map((proof) => (
        <div className="party-proof-row" key={proof.role}>
          <div>
            <strong>{roleCopy[proof.role].name}</strong>
            <small title={proof.party}>{proof.party}</small>
          </div>
          <MetricInline label="Visible contracts" value={String(proof.visibleContractCount)} />
          <MetricInline label="Private terms" value={proof.seesPrivateTerms ? "Visible" : "Hidden"} />
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  );
}

function MetricInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-inline">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "ok" | "danger" | "neutral" }) {
  return (
    <span className={`status-badge ${tone}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function PreviewStep({ title, text }: { title: string; text: string }) {
  return (
    <article className="preview-step">
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

function contractsOf<T extends ContractKind>(contracts: WorkflowContract[], kind: T) {
  return contracts.filter((contract) => contract.kind === kind) as Extract<WorkflowContract, { kind: T }>[];
}
