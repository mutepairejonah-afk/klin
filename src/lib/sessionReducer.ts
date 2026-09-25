// Pure fold over a SessionEvent[] into renderable state. This is the crux of
// the "one renderer, three modes" idea from the plan: the exact same
// function drives the live view (events grow over SSE), replay (events are
// sliced by a scrubber), and a shared read-only link (fixed event list).
import type {
  SessionEvent, Todo, AgentRole, ToolName, SchemaTable, Approval, Artifact,
} from './types';

export type ThreadItem =
  | { kind: 'thought'; role: AgentRole; text: string }
  | { kind: 'act'; role: AgentRole; tool: ToolName; verb: string; target: string }
  | { kind: 'approval'; approval: Approval; decision: 'pending' | 'approved' | 'rejected' }
  | { kind: 'verify'; checks: { label: string; passed: boolean }[] }
  | { kind: 'done'; text: string }
  | { kind: 'error'; message: string };

export type SessionPhase = 'planning' | 'executing' | 'approval' | 'verifying' | 'done' | 'failed';

export interface FileState { content: string; isNew: boolean; }

export interface FoldedState {
  todos: Todo[];
  activeIndex: number;
  role: AgentRole | null;
  phase: SessionPhase;
  thread: ThreadItem[];
  term: { text: string; stream: 'stdout' | 'stderr' }[];
  files: Record<string, FileState>;
  fileOrder: string[];
  currentFile: string | null;
  browserUrl: string | null;
  screenshotUrl: string | null;
  previewUrl: string | null;
  db: { sql: string; status: string; applied: boolean; tables: SchemaTable[] } | null;
  artifacts: Artifact[];
  pendingApproval: Approval | null;
  elapsedSec: number;
  finished: boolean;
  failed: boolean;
}

const initial: FoldedState = {
  todos: [], activeIndex: -1, role: null, phase: 'planning', thread: [], term: [],
  files: {}, fileOrder: [], currentFile: null, browserUrl: null, screenshotUrl: null,
  previewUrl: null, db: null, artifacts: [], pendingApproval: null, elapsedSec: 0,
  finished: false, failed: false,
};

export function foldEvents(events: SessionEvent[]): FoldedState {
  const s: FoldedState = structuredClone(initial);
  const resolvedApprovals = new Map<string, 'approved' | 'rejected'>();

  // First pass: know which approvals were resolved, so the thread item can
  // render in its final state even when replaying from the start.
  for (const e of events) if (e.type === 'approval.resolved') resolvedApprovals.set(e.payload.id, e.payload.decision);

  for (const e of events) {
    s.elapsedSec = Math.max(s.elapsedSec, secondsSince(events[0]?.ts, e.ts));
    switch (e.type) {
      case 'plan.updated':
        s.todos = e.payload.todos;
        s.activeIndex = s.todos.findIndex((t) => !t.done);
        break;
      case 'thought':
        s.thread.push({ kind: 'thought', role: e.payload.role, text: e.payload.text });
        s.role = e.payload.role;
        break;
      case 'action.started':
        s.thread.push({ kind: 'act', role: e.payload.role, tool: e.payload.tool, verb: e.payload.verb, target: e.payload.target });
        s.role = e.payload.role;
        s.phase = 'executing';
        break;
      case 'terminal.stdout':
        s.term.push({ text: e.payload.line, stream: 'stdout' });
        break;
      case 'terminal.stderr':
        s.term.push({ text: e.payload.line, stream: 'stderr' });
        break;
      case 'file.created':
      case 'file.modified':
        s.files[e.payload.path] = { content: e.payload.content ?? '', isNew: e.type === 'file.created' };
        if (!s.fileOrder.includes(e.payload.path)) s.fileOrder.push(e.payload.path);
        s.currentFile = e.payload.path;
        break;
      case 'file.deleted':
        delete s.files[e.payload.path];
        s.fileOrder = s.fileOrder.filter((p) => p !== e.payload.path);
        break;
      case 'browser.navigate':
        s.browserUrl = e.payload.url;
        break;
      case 'browser.screenshot':
        s.screenshotUrl = e.payload.url;
        break;
      case 'db.schema':
      case 'db.query':
        s.db = {
          sql: e.payload.sql ?? '',
          status: e.payload.status ?? '',
          applied: !!e.payload.applied,
          tables: e.payload.tables ?? s.db?.tables ?? [],
        };
        break;
      case 'deploy.preview_url':
        s.previewUrl = e.payload.url;
        break;
      case 'approval.requested': {
        const decision = resolvedApprovals.get(e.payload.id) ?? 'pending';
        s.thread.push({ kind: 'approval', approval: e.payload, decision });
        s.phase = decision === 'pending' ? 'approval' : s.phase;
        if (decision === 'pending') s.pendingApproval = e.payload;
        break;
      }
      case 'approval.resolved':
        if (s.pendingApproval?.id === e.payload.id) s.pendingApproval = null;
        break;
      case 'critic.verdict':
        s.thread.push({ kind: 'verify', checks: e.payload.checks });
        s.phase = 'verifying';
        break;
      case 'artifact.created':
        s.artifacts.push(e.payload);
        break;
      case 'error':
        s.thread.push({ kind: 'error', message: e.payload.message });
        s.failed = true;
        s.phase = 'failed';
        break;
      case 'session.done':
        s.thread.push({ kind: 'done', text: e.payload.summary });
        s.finished = true;
        s.phase = 'done';
        s.role = null;
        break;
      // git.commit / git.pr_opened / test.result are informational; the UI
      // reads their effect via artifact.created (PRs, test reports) so no
      // extra state is needed here, but keep the case so TS checks it.
      case 'git.commit':
      case 'git.pr_opened':
      case 'test.result':
      case 'action.completed':
        break;
    }
  }
  return s;
}

function secondsSince(a?: string, b?: string) {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000));
}

export function statusFromFold(f: FoldedState, sessionStatus: string): string {
  if (f.pendingApproval) return 'waiting_approval';
  if (f.finished) return f.failed ? 'failed' : 'done';
  return sessionStatus;
}
