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

// Clerk (via ClerkProvider in main.tsx) attaches itself to window.Clerk once
// loaded. Reading the session token here — rather than threading it through
// every call site — keeps every existing api.ts function signature unchanged.
async function clerkToken(): Promise<string | undefined> {
  const clerk = (window as any).Clerk;
  if (!clerk?.session) return undefined;
  try { return await clerk.session.getToken(); } catch { return undefined; }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await clerkToken();
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
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
    http<{ accepted: boolean }>(`/sessions/${id}/message`, { method: 'POST', body: JSON.stringify({ message }) }),
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
  // A fresh token is read on every (re)connect: Clerk session tokens live
  // ~60s, so reusing the first one made every retry after a drop a 401. The
  // loop keeps retrying with capped backoff until the caller unsubscribes, and
  // `onOpen` fires after each successful (re)connect so callers can resync
  // anything they missed while the stream was down.
  subscribe(
    id: string,
    onEvent: (e: SessionEvent) => void,
    onError?: (e: Event) => void,
    onOpen?: () => void,
  ) {
    const controller = new AbortController();
    let cancelled = false;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    void (async () => {
      let attempt = 0;
      while (!cancelled) {
        try {
          const token = await clerkToken();
          if (cancelled) return;
          const res = await fetch(`${API_BASE}/sessions/${id}/events`, {
            credentials: 'include',
            signal: controller.signal,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          if (!res.ok || !res.body) throw new ApiError(res.status, await res.text().catch(() => res.statusText));
          attempt = 0;
          onOpen?.();
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
          // Stream ended cleanly (server restart, proxy idle timeout). Fall
          // through to the backoff below instead of reconnecting in a tight loop.
          if (!cancelled) onError?.(new Event('stream-ended'));
        } catch (err) {
          if (cancelled || (err as { name?: string })?.name === 'AbortError') return;
          onError?.(err as Event);
        }
        attempt += 1;
        await wait(Math.min(1000 * 2 ** Math.min(attempt, 4), 15000));
      }
    })();
    return () => { cancelled = true; controller.abort(); };
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
