// ---------------------------------------------------------------------------
// Backend seam. Every function here is a thin fetch wrapper over the REST
// surface in docs/BACKEND.md. Protected requests never leave the browser
// without a Clerk bearer token.
// ---------------------------------------------------------------------------
import type {
  Session, SessionEvent, Connector, Secret, Schedule, AuditEntry, Member,
  UsageSummary, Artifact, SessionStatus,
} from './types';

const configuredApiBase = import.meta.env.VITE_API_BASE ?? '/api';
export const API_BASE = configuredApiBase.replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; }
}

export class AuthRequiredError extends ApiError {
  constructor(message = 'Your Clerk session is not ready or has expired. Please sign in again.') { super(401, message); this.name = 'AuthRequiredError'; }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ClerkLike {
  loaded?: boolean;
  session?: { getToken: (options?: { skipCache?: boolean }) => Promise<string | null> };
}

async function clerkInstance(): Promise<ClerkLike> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const clerk = (window as any).Clerk as ClerkLike | undefined;
    if (clerk) return clerk;
    await sleep(50);
  }
  throw new AuthRequiredError('Clerk did not finish loading. Please reload and sign in again.');
}

// ClerkProvider may have mounted React before its browser object has finished
// loading. Wait for readiness instead of sending a request with no auth header.
async function clerkToken(required = true): Promise<string | undefined> {
  const clerk = await clerkInstance();
  const deadline = Date.now() + 10_000;
  while (clerk.loaded !== true && Date.now() < deadline) await sleep(50);
  if (clerk.loaded !== true) {
    if (!required) return undefined;
    throw new AuthRequiredError('Clerk is still loading. Please try again in a moment.');
  }
  if (!clerk.session) {
    if (!required) return undefined;
    throw new AuthRequiredError();
  }
  const token = await clerk.session.getToken();
  if (!token && required) throw new AuthRequiredError();
  return token ?? undefined;
}

async function http<T>(path: string, init?: RequestInit, auth: 'required' | 'optional' = 'required'): Promise<T> {
  const token = await clerkToken(auth === 'required');
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401 && auth === 'required') throw new AuthRequiredError(body || 'Your session is no longer authorized. Please sign in again.');
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
  agent?: { slug: string; name: string; systemPrompt: string };
}
export const sessionsApi = {
  list: (filter?: { status?: SessionStatus; repo?: string }) =>
    http<Session[]>(`/sessions${qs(filter)}`),
  get: (id: string) => http<Session>(`/sessions/${id}`),
  delete: (id: string) => http<void>(`/sessions/${id}`, { method: 'DELETE' }),
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

  // Live event stream. Uses fetch rather than native EventSource so Clerk's
  // bearer token stays in an Authorization header, not in URLs/proxy logs.
  subscribe(id: string, onEvent: (e: SessionEvent) => void, onError?: (e: unknown) => void) {
    const controller = new AbortController();
    let cancelled = false;
    void (async () => {
      let attempt = 0;
      while (!cancelled && attempt < 5) {
        let token: string;
        try {
          token = (await clerkToken(true))!;
        } catch (error) {
          if (!cancelled) onError?.(error);
          return;
        }
        try {
          const res = await fetch(`${API_BASE}/sessions/${id}/events`, {
            credentials: 'include',
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.status === 401) {
            onError?.(new AuthRequiredError('The live session authorization expired. Please sign in again.'));
            return;
          }
          if (!res.ok || !res.body) throw new ApiError(res.status, await res.text().catch(() => res.statusText));
          attempt = 0;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (!cancelled) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const frames = buffer.split('\n\n');
            buffer = frames.pop() ?? '';
            for (const frame of frames) {
              const data = frame.split('\n').find((line) => line.startsWith('data:'))?.slice(5).trim();
              if (!data) continue;
              try { onEvent(JSON.parse(data) as SessionEvent); } catch { /* ignore malformed frame */ }
            }
          }
          if (!cancelled) attempt += 1;
        } catch (err) {
          if (cancelled) return;
          attempt += 1;
          if (attempt >= 5) { onError?.(err); return; }
          await sleep(Math.min(1000 * 2 ** attempt, 8000));
        }
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  },
};

// A read-only variant for shared links (no auth, id is an opaque share token).
export const shareApi = {
  get: (token: string) => http<Session>(`/share/${token}`, undefined, 'optional'),
  replay: (token: string) => http<SessionEvent[]>(`/share/${token}/replay`, undefined, 'optional'),
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
  githubOAuthUrl: () => http<{ url: string }>('/connections/github/start'),
  githubRepos: () => http<{ fullName: string; private: boolean; defaultBranch: string; updatedAt: string }[]>('/connections/github/repos'),
  githubBranches: (fullName: string) => http<string[]>(`/connections/github/repos/${fullName}/branches`),
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
  modelRouting?: { provider?: 'openrouter' | 'google' | 'ollama' | 'anthropic'; model?: string } | null;
  networkAllowlist: string[];
  approvalRules: Record<string, boolean>;
}
export interface ModelCatalogEntry {
  id: 'openrouter' | 'google' | 'ollama' | 'anthropic';
  label: string;
  configured: boolean;
  models: { id: string; label: string }[];
}
export const settingsApi = {
  get: () => http<UserSettings>('/settings'),
  update: (patch: Partial<UserSettings>) =>
    http<UserSettings>('/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
};
export const modelsApi = { list: () => http<ModelCatalogEntry[]>('/models') };
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
