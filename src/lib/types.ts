// ---------------------------------------------------------------------------
// Shared types. These mirror the data model and event contract in the
// implementation plan (sections 4, 11, 13) plus a few additions the UI
// needs that the plan didn't spell out (flagged in docs/BACKEND.md).
// ---------------------------------------------------------------------------

export type AgentRole = 'planner' | 'executor' | 'critic' | 'retriever';

export type ToolName =
  | 'terminal' | 'editor' | 'browser' | 'preview' | 'db' | 'deploy' | 'git' | 'github' | 'tests';

export type SessionStatus =
  | 'queued' | 'planning' | 'executing' | 'waiting_approval' | 'verifying'
  | 'paused' | 'done' | 'failed';

export interface Todo {
  id: string;
  label: string;
  done: boolean;
}

export interface SchemaColumn { name: string; type: string; }
export interface SchemaTable { name: string; columns: SchemaColumn[]; }

export interface Approval {
  id: string;
  title: string;
  body: string;
  command?: string;      // the SQL / shell command / diff being gated
  rollback?: string;
  blastRadius?: string;
}

export type ArtifactKind = 'pr' | 'diff' | 'file' | 'schema' | 'preview' | 'test' | 'screenshot';

export interface Artifact {
  id: string;
  sessionId: string;
  kind: ArtifactKind;
  title: string;
  meta?: string;
  url?: string;
  createdAt: string;
}

// ---- Session event stream --------------------------------------------------
// Transport: SSE (GET /sessions/:id/events) for the live case, the same
// shape replayed from GET /sessions/:id/replay for the historical case.
// Every event is persisted before being sent, so folding events 0..n always
// reproduces the exact state at that point (see lib/sessionReducer.ts).

interface EventBase<T extends string, P> {
  seq: number;
  ts: string; // ISO timestamp
  type: T;
  payload: P;
}

export type SessionEvent =
  | EventBase<'plan.updated', { todos: Todo[] }>
  | EventBase<'thought', { role: AgentRole; text: string }>
  | EventBase<'action.started', { role: AgentRole; tool: ToolName; verb: string; target: string }>
  | EventBase<'action.completed', { tool: ToolName; result?: string }>
  | EventBase<'terminal.stdout', { line: string }>
  | EventBase<'terminal.stderr', { line: string }>
  | EventBase<'file.created' | 'file.modified' | 'file.deleted', { path: string; content?: string }>
  | EventBase<'diff.ready', { path: string; diff: string }>
  | EventBase<'browser.navigate', { url: string }>
  | EventBase<'browser.screenshot', { url: string }>
  | EventBase<'db.schema' | 'db.query', { sql?: string; status?: string; tables?: SchemaTable[]; applied?: boolean }>
  | EventBase<'git.commit', { sha: string; message: string }>
  | EventBase<'git.pr_opened', { url: string; title: string; stats?: string }>
  | EventBase<'test.result', { passed: number; failed: number; report?: string }>
  | EventBase<'deploy.preview_url', { url: string }>
  | EventBase<'approval.requested', Approval>
  | EventBase<'approval.resolved', { id: string; decision: 'approved' | 'rejected' }>
  // Extension beyond the plan's event list: lets the Critic show its
  // checklist inline instead of the UI inferring "done" silently.
  | EventBase<'critic.verdict', { checks: { label: string; passed: boolean }[] }>
  | EventBase<'artifact.created', Artifact>
  | EventBase<'error', { message: string }>
  | EventBase<'session.done', { summary: string }>;

export interface Session {
  id: string;
  userId: string;
  goal: string;
  status: SessionStatus;
  sandboxId?: string;
  repo?: string;
  branch?: string;
  jobId?: string;
  connectors?: string[];
  costUsd?: number;
  durationSec?: number;
  createdAt: string;
  endedAt?: string;
}

export interface JobTemplate {
  id: string;
  name: string;
  shortLabel: string;
  icon: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  placeholder: string;
  tools: string[];
  approvals: string[];
  criteria: string[];
  checks: string[];
}

export interface Connector {
  id: string;
  name: string;
  description: string;
  scopes: string[];
  connected: boolean;
  meta?: string;
  lastUsedAt?: string;
}

export interface Secret {
  id: string;
  handle: string;
  scope: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface Schedule {
  id: string;
  name: string;
  jobId: string;
  repo?: string;
  cadenceLabel: string;
  cadenceCron: string;
  nextRunAt?: string;
  enabled: boolean;
}

export interface AuditEntry {
  id: string;
  ts: string;
  actor: string;
  action: string;
  sessionId?: string;
  detail: string;
  ip?: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'operator' | 'viewer';
}

export interface UsageSummary {
  jobCompletionRate?: number;
  prMergeRate?: number;
  medianSessionSec?: number;
  approvalPromptRate?: number;
  costPerJobUsd?: number;
  secretLeaks?: number;
  costByDay?: { date: string; usd: number }[];
  costBreakdown?: { label: string; pct: number; usd: number }[];
  topSessions?: Session[];
}
