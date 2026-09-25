# Backend implementation plan

`docs/BACKEND.md` is the *spec* (what exists, shaped exactly how the
frontend already calls it). This is the *plan* — repo layout, build order,
what "done" means for each phase, and the decisions you'd otherwise have to
make ten times over the first month.

---

## 1. Decisions, made

Picking these now instead of per-PR is the point of this doc.

| Question | Decision | Why |
|---|---|---|
| Language/runtime | Node 20, TypeScript everywhere | One language across api/orchestrator/worker; matches the frontend so `lib/types.ts`'s `SessionEvent` union can be the literal source of truth on both sides |
| API framework | Fastify + Zod | Matches the original plan; Zod schemas double as request validation and can generate the OpenAPI doc for free |
| DB | Postgres + Drizzle ORM + pgvector | Relational data model in `docs/BACKEND.md §10` maps directly; pgvector covers repo-memory embeddings without a second datastore |
| Queue | Redis + BullMQ | Scheduled runs, idle-sandbox sweep, re-indexing, usage rollups (§11) |
| Agent | OpenHands, run inside the sandbox process, driven by the `orchestrator` service | Per the infra doc; don't hand-roll the Planner/Executor/Critic/Retriever loop unless OpenHands genuinely can't fit a job template |
| Sandbox | OpenSandbox, Docker runtime first | Per the infra doc; defer Firecracker/Kata to Phase 5 |
| Event transport | SSE (`GET /sessions/:id/events`) | Already what the frontend calls; add a Socket.IO bridge later only if `backendv1` needs one transport for everything else it does |
| Model gateway | One internal OpenAI-compatible endpoint, backed by Ollama in dev and vLLM in prod, with pass-through to Anthropic/OpenAI for hosted models | Lets Settings → Model routing change providers with zero orchestrator changes |
| Auth | Auth.js (or Clerk if you want managed) | Either satisfies `/auth/me`, `/auth/:provider/start`, `/auth/signout` as specified |
| Monorepo tool | npm workspaces (no Turborepo/Nx yet) | Four small services; add a build tool when the graph actually gets slow, not before |

---

## 2. Repo layout

```
kiln-backend/
  apps/
    api/                 Fastify app — every route in BACKEND.md §3
      src/routes/         one file per resource: sessions.ts, connections.ts,
                          secrets.ts, schedules.ts, artifacts.ts, usage.ts,
                          audit.ts, settings.ts, members.ts, memory.ts, auth.ts
      src/sse.ts          GET /sessions/:id/events handler
      src/plugins/        auth, rbac, rate-limit, request logging
    orchestrator/         Session lifecycle + agent loop driver
      src/loop.ts          Plan -> Act -> Observe -> Reflect -> Gate (BACKEND.md §5)
      src/openhands.ts     Adapter that calls OpenHands inside a sandbox
      src/events.ts        Appends to `events`, then publishes (BACKEND.md §4)
    worker/                BullMQ processors (BACKEND.md §11)
      src/jobs/schedules.ts, idle-sweep.ts, reindex.ts, artifact-export.ts,
          usage-rollup.ts
    model-gateway/          Thin OpenAI-compatible router: role -> provider
      src/router.ts         reads user_settings.model_routing per session
  packages/
    db/                    Drizzle schema + migrations (BACKEND.md §10)
    sandbox/                OpenSandbox client adapter (create/exec/snapshot/destroy)
    mcp/                    MCP tool servers: fs, shell, git, github, browser, db,
                            tests, deploy, secrets (BACKEND.md §6)
    shared-types/           SessionEvent, Session, Todo, Approval, Artifact, ...
                            — mirrors kiln-app/src/lib/types.ts by design;
                            consider generating one from the other (see §7)
    security/               Secret handle resolution, redaction, audit hash chain
  infra/
    docker-compose.yml      api + orchestrator + worker + postgres + redis +
                            ollama (dev) + one OpenSandbox node
    terraform/               prod: vLLM GPU pool, OpenSandbox fleet, RDS, Redis
```

---

## 3. Phases

Each phase has a concrete "you can now do X in the real app" acceptance
test, not just a feature list. Phase 0–2 alone gets you a demoable product
(one job template, real approvals, real PRs); everything after is breadth.

### Phase 0 — Skeleton (spec §13 step 1)
**Goal:** the frontend can create a session and watch a *scripted* run end
to end, with nothing real happening yet.
- `sessions`, `events` tables; `POST /sessions`, `GET /sessions/:id`,
  `GET /sessions/:id/events` (SSE), `GET /sessions/:id/replay`.
- Orchestrator stub: on session create, emit a canned `plan.updated` →
  a few `thought`/`action.started`/`terminal.stdout` → `session.done`,
  each persisted before it's sent.
- Auth skeleton (`/auth/me` returns a fixed dev user) so the sidebar and
  Settings pages have someone to show.
- **Done when:** `kiln-app` running against this backend shows a live
  session end to end with real SSE, no more "Backend not connected yet".

### Phase 1 — Real sandbox, one job template
**Goal:** `bug_fix` actually clones a repo, edits a file, runs tests, opens
a PR — the orchestrator drives OpenHands inside OpenSandbox instead of a
script.
- OpenSandbox (Docker runtime) behind `packages/sandbox`: create, exec,
  snapshot, destroy.
- `filesystem`, `shell`, `git` MCP tools (BACKEND.md §6).
- GitHub OAuth (`connections`, scoped read-only token first), `git.pr_opened`
  → `artifact.created(kind: 'pr')`.
- `connections`, `secrets` tables/endpoints.
- **Done when:** a real `bug_fix` session against a real (test) GitHub repo
  produces a real, mergeable PR, watched live in `kiln-app`.

### Phase 2 — Approvals, for real
**Goal:** the four always-on gates actually block, not just display.
- `approvals` table; orchestrator pauses execution (not just the UI) on
  any BACKEND.md §8 match until `approval.resolved` arrives.
- Server-side enforcement of the four non-toggleable rules regardless of
  what `user_settings.approval_rules` says.
- Audit log (`audit_logs`, hash-chained) starts here — every resolved
  approval is the first thing worth auditing.
- **Done when:** attempting `git push --force` inside a sandbox genuinely
  cannot proceed without a POST to `/sessions/:id/approvals/:aid`.

### Phase 3 — Database job + remaining tools
- `db` MCP tool: schema introspection, `generate_sql`, dry-run on a Neon/
  Supabase branch, `execute`, `rollback`.
- `browser` (Playwright) and `deploy` (Vercel/Fly preview) tools.
- `db_migration`, `feature_impl`, `deploy_preview` job templates now work
  end to end (previously only their `plan.updated` step was real).
- **Done when:** `db_migration` produces a dry-run you can watch in the
  Database tab, gated by an approval, then applies for real on approve.

### Phase 4 — Replay, share, remaining pages
- `GET /sessions/:id/replay`, `GET/POST /sessions/:id/share`,
  `GET /share/:token(/replay)` — all just read `events` in order; no new
  agent logic.
- `schedules`, `artifacts` (cross-session), `usage`, `audit` (already
  populated from Phase 2, now exposed), `settings`, `members`, `memory`
  endpoints (BACKEND.md §3's "additions beyond the original plan").
- Worker jobs: schedule cron-trigger, idle-sandbox sweep, usage rollup.
- **Done when:** every page in `kiln-app` is backed by real data, none of
  it demo.

### Phase 5 — Critic + verification layer
- Critic role wired into the loop; `critic.verdict` events before a todo
  flips to done (BACKEND.md §5 step 4).
- Verifier checks per job template (tests/lint/build/diff-size/no-secrets,
  per template's `checks[]` in `lib/jobs.ts`).
- **Done when:** a session's "Critic" role chip actually lights up, and a
  failed verification triggers a real retry/replan, not just a UI state.

### Phase 6 — Isolation & scale hardening
- Swap OpenSandbox's runtime from Docker to Firecracker or Kata for
  untrusted/multi-tenant load.
- Swap `model-gateway`'s executor-role default from Ollama to vLLM once
  there's a GPU box and real concurrency.
- Repo memory: pgvector + tree-sitter symbol index, wired to the
  `retriever` role and the Memory page's repo-index cards.
- Cost controls: per-org session concurrency limits, budget alerts.
- **Done when:** the success metrics in BACKEND.md §12 have real numbers
  behind them, not placeholders.

---

## 4. Migration order

Matches the phases above — don't create a table before the phase that
needs it, so an empty-but-present table never has to be explained away:

```
0001_sessions_events
0002_auth_users
0003_connections_secrets
0004_artifacts
0005_approvals
0006_audit_logs
0007_schedules
0008_settings_members_memory
0009_repo_index_embeddings   -- needs pgvector extension
```

---

## 5. Config & environments

Three environments minimum: `dev` (docker-compose, Ollama, Docker-runtime
sandbox, no real money moves — Stripe test mode only), `staging` (same
topology as prod, smaller scale, fake customer data), `prod`.

Env vars the `api` service needs at minimum (grows per phase):
```
DATABASE_URL
REDIS_URL
SESSION_SECRET
GITHUB_OAUTH_CLIENT_ID / _SECRET
MODEL_GATEWAY_URL
SANDBOX_PROVIDER_URL          # OpenSandbox endpoint
SANDBOX_NETWORK_ALLOWLIST     # comma-separated, enforced at the sandbox, not the app
```
Nothing above is a product *secret* (those live in the `secrets` table,
per-org, encrypted, handle-only to the model) — this is the backend's own
config, which is a different concern and shouldn't share infrastructure
with the customer-secrets feature.

---

## 6. Testing strategy

- **Reducer parity:** `packages/shared-types`'s `SessionEvent` union should
  be the one place both `orchestrator` and `kiln-app`'s `lib/types.ts`
  agree on its shape. Add a CI check that fails if they drift (JSON-schema
  diff, or literally generate one from the other).
- **Contract tests:** replay a fixed `events` array through both the
  frontend's `foldEvents()` and a backend equivalent (if you build one for
  server-side state, e.g. to compute `status`); assert they agree.
- **Sandbox integration tests:** a small suite that actually boots a
  sandbox, runs `bug_fix` against a fixture repo, and asserts a PR opens —
  slow, run nightly rather than per-PR.
- **Approval-gate tests:** for every rule in BACKEND.md §8, a test that
  proves the *server* — not just the UI — refuses to execute without an
  approval.
- **Load:** SSE fan-out and BullMQ throughput under N concurrent sessions,
  before Phase 6's isolation work, so you know if Firecracker's overhead
  is the bottleneck or something else was.

---

## 7. Keeping frontend and backend in sync

The fastest way this drifts: someone adds a field to `SessionEvent` in one
repo and not the other. Two reasonable options, pick one early:
1. `packages/shared-types` is the single source; `kiln-app` imports it via
   a published package (even a private npm package is fine for two repos).
2. Codegen: define the event schema once (e.g. as Zod schemas in the
   backend), generate the TypeScript types for `kiln-app` on every release.

Either way, decide before Phase 3 — by then there are enough event types
that manual sync starts costing real time.

---

## 8. Risk register

| Risk | Mitigation |
|---|---|
| Agent runs a destructive command outside the approval list | The list in BACKEND.md §8 is a floor, not a ceiling — log every `shell.exec` regardless, and review logs weekly for the first month to catch gaps |
| Sandbox escape / cross-tenant access | Phase 0–5 on Docker is an accepted short-term risk *only* for trusted/internal use; don't onboard external users before Phase 6's Firecracker/Kata move |
| Secret leak into model context | Automated test in Phase 1 that asserts secret values never appear in any persisted `event` payload or orchestrator log |
| Runaway cost from a stuck agent loop | Hard per-session token and wall-clock caps from Phase 0 on, not deferred to Phase 6's cost controls |
| SSE connection storms on reconnect | `seq`-based resume (BACKEND.md §4) from Phase 0, so a reconnect asks for "events after N" instead of the full replay |
