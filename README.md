# Kiln — autonomous coding agent (frontend)

A React + TypeScript port of the session UI: Home, Sessions, a live/replay
Session view (plan panel, computer view with terminal/editor/browser/
preview/database/events/artifacts tabs, approval gates), Jobs, Connections,
Scheduled, Library, Usage, Audit, Settings, Memory, sign-in, and a
read-only Share view.

**Ships with zero mock data.** Every list starts empty and every page has
its own empty state; nothing here will look "done" until it's wired to a
real backend.

## Stack, and why

Vite + React 18 + TypeScript + React Router + Zustand, plain CSS (the
design tokens/classes live in `src/styles/globals.css`) — **not** the
Next.js App Router the original plan named. Reasoning: this is a fully
client-rendered dashboard with no SEO surface, so Next's App Router buys
nothing here, and Vite is dramatically faster to scaffold, install, and
type-check. If you later want SSR, auth middleware at the edge, or React
Server Components, the port to Next is mechanical — the components,
hooks, and `lib/` layer don't assume a router.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build       # production build to dist/
```

Point it at a real API:

```bash
echo "VITE_API_BASE=https://api.yourdomain.com" > .env.local
```

Until then, every fetch fails safe: lists render their empty state, and
starting a task shows a "Backend not connected yet" toast.

## Where things live

```
src/
  lib/
    types.ts            Session, SessionEvent (discriminated union), Job,
                         Connector, Secret, Schedule, Artifact, ...
    api.ts               <-- the whole backend seam. One function per
                         endpoint in docs/BACKEND.md. Nothing else in the
                         app talks to fetch()/EventSource directly except
                         through this file (and the hooks below).
    sessionReducer.ts    Pure fold: SessionEvent[] -> renderable state.
                         Same function drives live, replay, and the
                         read-only share view — see the comment at the top.
    jobs.ts               Static job-template catalog (product config).
    connectorCatalog.ts   Static connector metadata (name/blurb/scopes);
                         connected-or-not comes from the backend.
    store.ts              Client-only UI state (theme, sidebar, the
                         connectors/repo/branch picked before a session
                         exists).
  hooks/
    useSessionEvents.ts   Live (SSE) / replay (fetch once + scrubber) /
                         share (read-only) — all three call foldEvents().
    useSessions.ts, useAuth.ts
  components/             Sidebar, Shell, ConnectorPicker, PlanCard,
                         ThreadPanel, ComputerPanel, Modal/Drawer/Toast,
                         Icon (inline SVG set, no icon-package dependency)
  pages/                  One file per route, registered in App.tsx
docs/
  BACKEND.md              Full backend spec: REST surface, event contract,
                         data model, sandbox/agent architecture, security,
                         build order.
  PLAN.md                Phased implementation plan: repo layout, decisions,
                         migration order, testing strategy, risk register.
```

## Brand

Everything reads from `src/lib/brand.ts`. Change `name`/`tagline` there —
the sidebar wordmark, browser title, sign-in copy, and composer
placeholder all follow.

## Known simplifications vs. the earlier HTML prototype

- No design-system dependency (Tailwind/shadcn) — plain CSS classes ported
  from the prototype instead, to keep the diff between "looks right" and
  "compiles" small.
- The terminal/editor panes render plain text, not a real xterm.js/Monaco
  instance — swap those in `ComputerPanel.tsx` when you want real
  scrollback buffers or syntax highlighting beyond the current
  lightweight version.
- No virtualization on the events/terminal lists; fine for a session's
  worth of events, worth adding if sessions get very long.
"# klin" 
