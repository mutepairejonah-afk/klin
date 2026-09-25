# Backend build list

This is everything the frontend in this repo expects to exist. It merges two
sources of truth from the conversation: the original **implementation plan**
(session model, event types, job templates, data model) and the **infra
recommendation** (OpenHands + OpenSandbox + Firecracker + vLLM, four-layer
separation). Where they disagree or one is silent, this doc says which wins
and why.

Every endpoint below is already called from `src/lib/api.ts`. Point
`VITE_API_BASE` (`.env`, default `/api`) at your server and the frontend
needs no other change.

---

## 1. Four layers, mapped to this repo

```
┌───────────────────────────────────────────────────────────┐
│  kiln-app (this repo) — React/Vite SPA                    │
│  Session UI · Plan panel · Computer view · Artifacts       │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST (api.ts) + SSE (useSessionEvents)
┌───────────────────────────▼─────────────────────────────────┐
│  App backend  ("backendv1" / orchestration service)        │
│  Auth · sessions · plans · approvals · artifacts · audit    │
│  · schedules · secrets · members · billing · event bus      │
└───────────┬──────────────────────────────────┬───────────────┘
            │                                  │
┌───────────▼───────────────┐      ┌───────────▼───────────────┐
│  Coding agent  (OpenHands) │      │  Sandbox runtime           │
│  Planner/Executor/Critic/  │◄────►│  (OpenSandbox; Docker now,│
│  Retriever loop, per job   │      │  Firecracker/Kata later)   │
└───────────┬───────────────┘      │  fs, shell, git, browser,  │
            │                      │  db, tests, deploy tools    │
┌───────────▼───────────────┐      └───────────┬───────────────┘
│  Model inference layer     │                  │
│  vLLM (prod) / Ollama      │                  ▼
│  /llama.cpp (dev) / hosted │      External integrations
│  Anthropic + OpenAI APIs   │      GitHub, Neon/Supabase,
└─────────────────────────────┘      Vercel/Fly, Stripe (test)
```

**Decision:** run the agent (OpenHands or an equivalent Planner→Executor→
Critic→Retriever loop) **inside** the sandbox process boundary, never on the
app-backend host — this is the one hard requirement both source documents
agree on. The app backend only ever talks to the sandbox through the
narrow tool API in §6, never by giving the agent a shell on its own host.

**Build vs. adopt:** OpenHands + OpenSandbox gets you §5 (agent loop) and §7
(sandbox) largely for free; the work in this doc is then mostly the App
backend column — sessions, auth, billing, the event bus, and the REST/SSE
surface the frontend already calls. If you'd rather hand-roll the agent
loop instead of adopting OpenHands, §5 states the contract it must satisfy.

---

## 2. Services to build/deploy

| Service | Responsibility | Suggested tech |
|---|---|---|
| `api` | REST + SSE surface for the frontend (§3), auth, RBAC, billing | Fastify/Express + TypeScript + Zod |
| `orchestrator` | Owns session lifecycle; runs the agent loop or drives OpenHands; persists every event before emitting it | Node, or OpenHands directly |
| `sandbox-runtime` | Provisions/destroys per-session sandboxes; exposes fs/shell/git/browser/db/tests/deploy over MCP | OpenSandbox (Docker → Firecracker/Kata) |
| `worker` | Async jobs: scheduled runs, idle sandbox pause/destroy, repo re-indexing, artifact export | BullMQ + Redis |
| `model-gateway` | Single OpenAI-compatible endpoint the orchestrator calls; routes each agent role to the model configured in Settings | vLLM (prod GPU) / Ollama or llama.cpp (dev) + pass-through to Anthropic/OpenAI for hosted models |

---

## 3. REST API — grouped by frontend page

Every route is prefixed with `VITE_API_BASE` (default `/api`). Auth is a
session cookie (`credentials: 'include'`) — see §9.

### Sessions (`Home`, `Sessions`, `SessionView`)
| Method | Path | Notes |
|---|---|---|
| GET | `/sessions?status=&repo=` | List, filterable — powers the sidebar, Home, Sessions table |
| POST | `/sessions` | `{ goal, jobId?, repo?, branch?, connectors? }` → creates session, kicks off orchestrator |
| GET | `/sessions/:id` | Session metadata |
| GET | `/sessions/:id/events` | **SSE**, `text/event-stream`, one `SessionEvent` JSON per `data:` line (§4) |
| GET | `/sessions/:id/replay` | Full persisted event array, same shape as the stream |
| POST | `/sessions/:id/pause` / `/resume` | |
| POST | `/sessions/:id/message` | Steer the agent mid-run (`{ message }`) |
| POST | `/sessions/:id/approvals/:aid` | `{ decision: 'approved'\|'rejected' }` — gates in §8 |
| GET | `/sessions/:id/artifacts` | Per-session artifacts |
| GET/POST | `/sessions/:id/share` | Get or set the public share link/token |
| GET | `/share/:token`, `/share/:token/replay` | Unauthenticated read-only mirrors of the two routes above, scoped by opaque token |

### Job templates (`Home`, `Jobs`)
Static config, shipped in the frontend (`src/lib/jobs.ts`) — **no endpoint
needed** unless you want operators to edit templates without a redeploy, in
which case add `GET/PUT /job-templates`.

### Connections (`Connections`)
| Method | Path | Notes |
|---|---|---|
| GET | `/connections` | Connected state + scopes + metadata per provider (`src/lib/connectorCatalog.ts` has the static blurb/name half) |
| POST | `/connections/:id/connect` | Starts/completes OAuth (`{ authCode }`) |
| DELETE | `/connections/:id` | |
| GET/POST/DELETE | `/secrets` | Handle-only; **never returns the value** (§8) |

### Scheduled (`Scheduled`) — addition beyond the original plan
| Method | Path |
|---|---|
| GET/POST | `/schedules` |
| PATCH/DELETE | `/schedules/:id` |

### Library (`Library`) — addition beyond the original plan
| Method | Path | Notes |
|---|---|---|
| GET | `/artifacts?kind=` | Cross-session artifact feed (the plan only specified per-session) |

### Usage & Audit (`Usage`, `Audit`)
| Method | Path |
|---|---|
| GET | `/usage` |
| GET | `/audit` |

### Settings, Memory, Members — additions beyond the original plan
| Method | Path |
|---|---|
| GET/PATCH | `/settings` (profile, model routing, coding prefs, approval-rule toggles) |
| GET/POST | `/members`, PATCH `/members/:id` |
| GET | `/memory/repos`, POST `/memory/repos/reindex` |
| GET/PATCH | `/memory/user` |
| GET/POST | `/memory/org` |

### Auth
| Method | Path |
|---|---|
| GET | `/auth/me` |
| GET | `/auth/:provider/start` (`github`\|`google`) → OAuth redirect |
| POST | `/auth/signout` |

### Direct sandbox exec (dev/debug only — never expose to end users)
| Method | Path |
|---|---|
| POST | `/sandboxes/:id/exec` |

---

## 4. Event contract (`SessionEvent`, `src/lib/types.ts`)

Transport is SSE in this build (`EventSource`, one JSON object per event).
If you'd rather standardize on Socket.IO across your existing apps, that's
a fine substitution — keep the **event envelope** identical either way:

```ts
{ seq: number; ts: string; type: string; payload: {...} }
```

`seq` is what lets a reconnecting client (or the replay scrubber) ask "give
me everything after N" instead of refetching the whole log — persist each
event **before** sending it, and never renumber or skip.

Frontend event types (`type` values) and the equivalent Socket.IO event
names, if you go that route instead:

| SessionEvent `type` | Socket.IO equivalent | Fired when |
|---|---|---|
| `plan.updated` | `ai:plan` | Planner (re)writes the todo list |
| `thought` | — (add `ai:thought`) | Any role reasons out loud |
| `action.started` / `action.completed` | `ai:command:start` / `ai:command:complete` | Executor invokes a tool |
| `terminal.stdout` / `terminal.stderr` | `ai:command:output` | Shell tool output, streamed |
| `file.created` / `file.modified` / `file.deleted` | `ai:file:changed` | Filesystem tool writes |
| `browser.navigate` / `browser.screenshot` | — (add `ai:browser:*`) | Browser tool |
| `db.schema` / `db.query` | — (add `ai:db:*`) | Database tool (dry-run vs. applied is `payload.applied`) |
| `git.commit` / `git.pr_opened` | — (add `ai:git:*`) | Git/GitHub tool |
| `test.result` | `ai:test:result` | Test tool |
| `deploy.preview_url` | — (add `ai:deploy:preview`) | Deploy tool |
| `approval.requested` / `approval.resolved` | `ai:approval:required` / (add resolved) | Safety gate (§8) opens/closes |
| `critic.verdict` | — (extension; add `ai:critic:verdict`) | Critic checks a todo before marking it done |
| `artifact.created` | — (add `ai:artifact:created`) | PR/diff/schema/test-report/screenshot produced |
| `error` | `ai:task:failed` | Unrecoverable failure |
| `session.done` | `ai:task:completed` | Final summary |

Every event also needs a durable row in `events` (§5's `sessions`/`events`
tables) — that's what makes `/sessions/:id/replay` and the share links work
without the orchestrator being involved after the fact.

---

## 5. Agent loop contract

Whichever you use — OpenHands as-is, or a hand-rolled loop — it must, per
session:

1. **Plan**: decompose `goal` into an ordered `Todo[]`, emit `plan.updated`.
2. **Act**: for the next incomplete todo, pick a tool, call it inside the
   sandbox, emit `action.started` → tool-specific events → `action.completed`.
3. **Observe**: capture the tool's result (stdout, diff, test report,
   screenshot, DB rows) as the corresponding event + an `artifact.created`
   where relevant.
4. **Reflect** (Critic role): decide done / retry / replan / ask the user;
   emit `critic.verdict` before flipping a todo to done.
5. **Gate**: before any action matching §8's list, emit
   `approval.requested` and **block** — do not call the tool — until
   `approval.resolved` with `decision: 'approved'` arrives.
6. Repeat until every todo is done, then emit `session.done`.

Four roles, four system prompts, routed independently per the Settings
page's model-routing card:

| Role | Job | Suggested default |
|---|---|---|
| Planner | Goal → todo list; re-plans on failure | Large/hosted model (Anthropic or OpenAI) |
| Executor | One todo at a time, picks tools, streams actions | Fast model — this is what's in the hot loop, so cost/latency matter most here (vLLM/Ollama self-hosted is the cheap option) |
| Critic | Verifies a todo's result before it's marked done | Large/hosted model |
| Retriever | Pulls repo context, docs, issue threads into working memory | Can be a fast model — it's doing retrieval + light summarization, not the write-a-diff step |

`model-gateway` (§2) should expose one OpenAI-compatible `/v1/chat/completions`
regardless of which of these actually serves the request, so swapping
Settings → Model routing doesn't touch the orchestrator's code.

---

## 6. Tools exposed to the agent (MCP)

Matches the Connections → Tools tab. Each is a small MCP server the
orchestrator calls; the agent never gets raw host access.

| Tool | Calls |
|---|---|
| `filesystem` | `read_file`, `write_file`, `list_dir`, `apply_patch`, `search` |
| `shell` | `exec(cmd, cwd, timeout)`, streaming stdout/stderr |
| `git` | `clone`, `status`, `diff`, `branch`, `commit`, `push`, `pr_create` |
| `github` (API, not shell) | `get_issue`, `list_prs`, `comment`, `review`, `labels` |
| `browser` | `navigate`, `click`, `type`, `screenshot`, `extract` (headless Chromium/Playwright) |
| `db` | `get_schema`, `generate_sql`, `dry_run`, `execute`, `rollback`, branch a throwaway DB (Neon/Supabase) |
| `tests` | `run_tests`, `parse_results` |
| `deploy` | `preview_deploy`, `logs`, `rollback_deploy` |
| `secrets` | `request_secret(handle)` — resolves to a value **inside the sandbox only**, never returned to the model (§8) |

---

## 7. Sandbox runtime

**Recommendation:** OpenSandbox, Docker runtime to start, Firecracker or
Kata Containers once you need to run multiple tenants' untrusted code
side by side (its own docs call out gVisor as a lower-effort halfway step).
Don't start on bare Firecracker — OpenSandbox already wraps it.

Per session:
- Isolated container/microVM, non-root user, CPU/memory/disk quotas,
  execution timeouts, process limits, no privileged mode, no Docker socket.
- Base image: Node 20+, Python 3.11+, Go, Rust, Bun, `git`, `gh`,
  headless Chromium + Playwright, `psql`/`sqlite3`, `ripgrep`/`fd`/`jq`.
- Persistent volume at `/workspace`; snapshot after every completed todo
  (filesystem + git state) so a session can resume or roll back.
- Network egress **allowlist only**: GitHub, package registries, the
  provider APIs the session's connectors need. Nothing else.
- Scoped, short-lived credentials per session — never your org's master
  GitHub token or production database URL (§8).
- Lifecycle: boot → clone/install → run (snapshot per todo) → idle 15 min
  → pause → 24 h → destroy (or freeze specifically for replay/share, so a
  shared link still has something to point at).

Judge0 is optional and orthogonal: if you ever want a "run just this file,
enforce a time/memory limit, return stdout/exit code" primitive separate
from the persistent dev sandbox (e.g. grading, one-off snippets), it's a
fine bolt-on. It should never be where the main coding-agent loop runs —
it's not a persistent workspace.

---

## 8. Safety gates (`approval.requested`)

The orchestrator must pause and request approval — not just log a warning —
before any of:

- `git push --force`
- `rm -rf`, `DROP`, `TRUNCATE`, `DELETE` without `WHERE`
- `ALTER TABLE … DROP`
- Production deploys
- Using a secret
- Spending money (Stripe, cloud APIs)
- Installing system-level packages
- Running untrusted code (e.g. a dependency's post-install script)
- Bulk writes to third-party APIs (e.g. >20 issue comments in one job)

Each `approval.requested` payload needs enough for the UI's approval card:
`title`, `body`, the actual `command`/SQL/diff being gated, a `rollback`
plan, and a one-line `blastRadius` statement. The four rules always shown
as "Always" in Settings (force push, destructive SQL, DROP, prod deploy)
are not user-toggleable — enforce that server-side too, not just in the UI.

Secrets: the model only ever sees a **handle** (`STRIPE_SECRET_KEY`, say).
The sandbox resolves the handle to a value at the moment a command runs;
the value never enters the model's context window and never appears in a
persisted event, log line, or shared replay.

---

## 9. Auth & RBAC

- OAuth via GitHub/Google (Clerk or Auth.js are both fine); session cookie,
  `credentials: 'include'` from the frontend.
- Roles: **owner**, **operator**, **viewer** (`Member.role`) — matches the
  Settings → Members table. Only owner/operator can resolve approvals,
  manage secrets, or change connectors; viewer is read-only across
  sessions, library, and audit.
- Every session, secret, and connector is scoped to an org/workspace, not
  a single user — so a teammate leaving doesn't strand anyone's sessions.

---

## 10. Data model

Builds on the plan's original tables; additions the frontend needs are
marked.

```
sessions        id, org_id, user_id, goal, status, job_id, repo, branch,
                connectors[], sandbox_id, cost_usd, duration_sec,
                created_at, ended_at

events          id, session_id, seq, type, payload (jsonb), ts
                -- append-only; this table *is* the replay/share source

artifacts       id, session_id, kind, title, meta, url, created_at

approvals       id, session_id, event_id, status, requested_at,
                resolved_at, decision, resolved_by

sandboxes       id, session_id, provider, machine_id, region, status

connections     id, org_id, provider, encrypted_credentials, scopes,
                connected_at                                          -- (org-scoped, not per-user)

secrets         id, org_id, handle, encrypted_value, scope, created_at,
                last_used_at

schedules       id, org_id, name, job_id, repo, cadence_cron,
                next_run_at, enabled                                  -- addition

members         id, org_id, user_id, role                             -- addition

user_settings   org_id (or user_id), name, email, test_framework,
                commit_style, branch_naming, model_routing (jsonb),
                network_allowlist[], approval_rules (jsonb)            -- addition

user_memory     org_id, key, value                                    -- addition
org_memory      id, org_id, text, kind                                -- addition
repo_index      org_id, repo, files, symbols, indexed_at, stale       -- addition

audit_logs      id, org_id, actor, action, session_id, detail, ip,
                ts, prev_hash, hash                                   -- signed hash chain
```

`repo_index`/`user_memory`/`org_memory` back the Memory page; `session
memory` on that page is just a count query over `sessions`/`events`, no
separate table needed. Code search itself (embeddings + a tree-sitter
symbol graph) is Postgres + pgvector, as in the original plan — LlamaIndex
is a reasonable framework to build that retrieval layer on top of rather
than hand-rolling it, per the infra recommendation.

---

## 11. Background workers

BullMQ (or equivalent) jobs:
- **Scheduled runs**: cron-trigger sessions from `schedules`.
- **Sandbox idle sweep**: pause at 15 min idle, destroy at 24 h.
- **Repo re-indexing**: on connector connect, on demand from Memory page,
  and periodically.
- **Artifact export / sandbox freeze**: on session end, so replay and share
  links keep working after the sandbox itself is gone.
- **Usage rollups**: nightly aggregation feeding `/usage`.

---

## 12. Observability & cost

- Trace every tool call (OpenTelemetry span per `action.started`→`completed`).
- Metrics: session duration, tool error rate, approval latency, cost/session,
  tokens by role (planner/executor/critic/retriever), sandbox minutes.
- Structured, redacted logs (secrets never logged — see §8).
- `/usage` aggregates: job completion rate, PR merge rate, median session
  time, approval prompt rate, cost per successful job, secret-leak count
  (target zero) — these are exactly the KPI cards on the Usage page.

---

## 13. Suggested build order

1. `sessions` + `events` tables, the SSE endpoint, and a stub orchestrator
   that just emits a canned event script — lets you build/demo the frontend
   against something real before the agent loop exists.
2. Stand up OpenSandbox (Docker runtime) + the `filesystem`/`shell`/`git`
   MCP tools; wire one job template (`bug_fix`) end to end.
3. Auth, `connections`, `secrets`, GitHub OAuth + PR creation.
4. Approval gates (§8) end to end, including the four non-toggleable rules.
5. `db` tool with dry-run/rollback on a Neon or Supabase branch.
6. `browser` + `deploy` tools, preview URLs.
7. Replay (`/sessions/:id/replay`) and share links.
8. Critic role + `critic.verdict` events.
9. Remaining job templates, `schedules`, `usage`, `audit`, `memory`,
   `settings`, `members`.
10. Move sandbox isolation from Docker to Firecracker/Kata once you need
    real multi-tenant isolation; swap `model-gateway` from Ollama/llama.cpp
    to vLLM once you're on a GPU box with real concurrency.
