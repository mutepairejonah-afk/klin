// ---------------------------------------------------------------------------
// Backend seam. Every function here is a thin fetch wrapper over the REST
// surface in docs/BACKEND.md. Nothing in this file has business logic or
// mock data — point API_BASE at your API and these become real.
// ---------------------------------------------------------------------------
import type {
  Session, SessionEvent, Connector, Secret, Schedule, AuditEntry, Member,
  UsageSummary, Artifact, SessionStatus,
} from './types';

export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- Sessions ---------------------------------------------------------------
export interface CreateSessionInput {
  goal: string;
  jobId?: string | null;
  repo?: string;
  branch?: string;
  connectors?: string[];
}
export const sessionsApi = {
  list: (filter?: { status?: SessionStatus; repo?: string }) =>
    http<Session[]>(`/sessions${qs(filter)}`),
  get: (id: string) => http<Session>(`/sessions/${id}`),
  create: (input: CreateSessionInput) =>
    http<Session>('/sessions', { method: 'POST', body: JSON.stringify(input) }),
  pause: (id: string) => http<void>(`/sessions/${id}/pause`, { method: 'POST' }),
  resume: (id: string) => http<void>(`/sessions/${id}/resume`, { method: 'POST' }),
  sendMessage: (id: string, message: string) =>
    http<void>(`/sessions/${id}/message`, { method: 'POST', body: JSON.stringify({ message }) }),
  resolveApproval: (id: string, approvalId: string, decision: 'approved' | 'rejected') =>
    http<void>(`/sessions/${id}/approvals/${approvalId}`, {
      method: 'POST', body: JSON.stringify({ decision }),
    }),
  artifacts: (id: string) => http<Artifact[]>(`/sessions/${id}/artifacts`),
  replay: (id: string) => http<SessionEvent[]>(`/sessions/${id}/replay`),
  share: (id: string) => http<{ url: string; public: boolean }>(`/sessions/${id}/share`),
  setSharePublic: (id: string, isPublic: boolean) =>
    http<{ url: string; public: boolean }>(`/sessions/${id}/share`, {
      method: 'POST', body: JSON.stringify({ public: isPublic }),
    }),

  // Live event stream. Returns an unsubscribe function.
  // Backend: GET /sessions/:id/events as text/event-stream, one JSON
  // SessionEvent per `data:` line (see docs/BACKEND.md ยง Event Streaming).
  subscribe(id: string, onEvent: (e: SessionEvent) => void, onError?: (e: Event) => void) {
    const es = new EventSource(`${API_BASE}/sessions/${id}/events`, { withCredentials: true });
    es.onmessage = (msg) => {
      try { onEvent(JSON.parse(msg.data) as SessionEvent); } catch { /* ignore malformed frame */ }
    };
    if (onError) es.onerror = onError;
    return () => es.close();
  },
};

// A read-only variant for shared links (no auth, id is an opaque share token).
export const shareApi = {
  get: (token: string) => http<Session>(`/share/${token}`),
  replay: (token: string) => http<SessionEvent[]>(`/share/${token}/replay`),
};

// ---- Jobs (static catalog; see lib/jobs.ts) ---------------------------------
// Job templates are product configuration, not user data, so they ship as a
// constant in the frontend (lib/jobs.ts). If you want operators to edit them
// without a redeploy, add GET/PUT /job-templates and read from there instead.

// ---- Connections / secrets / tools ------------------------------------------
export const connectionsApi = {
  list: () => http<Connector[]>('/connections'),
  connect: (id: string, authCode?: string) =>
    http<Connector>(`/connections/${id}/connect`, { method: 'POST', body: JSON.stringify({ authCode }) }),
  disconnect: (id: string) => http<void>(`/connections/${id}`, { method: 'DELETE' }),
};
export const secretsApi = {
  list: () => http<Secret[]>('/secrets'),
  create: (handle: string, value: string, scope: string) =>
    http<Secret>('/secrets', { method: 'POST', body: JSON.stringify({ handle, value, scope }) }),
  remove: (id: string) => http<void>(`/secrets/${id}`, { method: 'DELETE' }),
};

// ---- Schedules ---------------------------------------------------------------
export const schedulesApi = {
  list: () => http<Schedule[]>('/schedules'),
  create: (s: Omit<Schedule, 'id' | 'nextRunAt'>) =>
    http<Schedule>('/schedules', { method: 'POST', body: JSON.stringify(s) }),
  update: (id: string, patch: Partial<Schedule>) =>
    http<Schedule>(`/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id: string) => http<void>(`/schedules/${id}`, { method: 'DELETE' }),
};

// ---- Library / artifacts (cross-session) -------------------------------------
export const artifactsApi = {
  list: (kind?: string) => http<Artifact[]>(`/artifacts${qs({ kind })}`),
};

// ---- Usage & audit -------------------------------------------------------------
export const usageApi = { get: () => http<UsageSummary>('/usage') };
export const auditApi = { list: () => http<AuditEntry[]>('/audit') };

// ---- Settings, members, memory ------------------------------------------------
export interface UserSettings {
  name: string; email: string;
  testFramework: string; commitStyle: string; branchNaming: string;
  modelRouting: Record<'planner' | 'executor' | 'critic' | 'retriever', string>;
  networkAllowlist: string[];
  approvalRules: Record<string, boolean>;
}
export const settingsApi = {
  get: () => http<UserSettings>('/settings'),
  update: (patch: Partial<UserSettings>) =>
    http<UserSettings>('/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
};
export const membersApi = {
  list: () => http<Member[]>('/members'),
  invite: (email: string, role: Member['role']) =>
    http<Member>('/members', { method: 'POST', body: JSON.stringify({ email, role }) }),
  updateRole: (id: string, role: Member['role']) =>
    http<Member>(`/members/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
};
export const memoryApi = {
  repoIndex: () => http<{ repo: string; files: number; symbols: number; indexedAt: string; stale: boolean }[]>('/memory/repos'),
  reindexRepo: (repo: string) => http<void>('/memory/repos/reindex', { method: 'POST', body: JSON.stringify({ repo }) }),
  userMemory: () => http<Record<string, string>>('/memory/user'),
  updateUserMemory: (patch: Record<string, string>) =>
    http<Record<string, string>>('/memory/user', { method: 'PATCH', body: JSON.stringify(patch) }),
  orgMemory: () => http<{ id: string; text: string; kind: string }[]>('/memory/org'),
  addOrgMemory: (text: string, kind: string) =>
    http<{ id: string; text: string; kind: string }>('/memory/org', { method: 'POST', body: JSON.stringify({ text, kind }) }),
};

// ---- Auth ----------------------------------------------------------------------
export const authApi = {
  me: () => http<{ id: string; name: string; email: string } | null>('/auth/me'),
  signOut: () => http<void>('/auth/signout', { method: 'POST' }),
  oauthUrl: (provider: 'github' | 'google') => `${API_BASE}/auth/${provider}/start`,
};

function qs(params?: Record<string, string | undefined>) {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (!entries.length) return '';
  return '?' + new URLSearchParams(entries as [string, string][]).toString();
}
