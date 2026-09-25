import Icon from './Icon';
import type { FoldedState } from '@/lib/sessionReducer';
import { TOOL_ICON, TOOL_LABEL } from '@/lib/toolMeta';
import type { SessionEvent, ArtifactKind } from '@/lib/types';

const TABS: { key: string; label: string; icon: string }[] = [
  { key: 'terminal', label: 'Terminal', icon: 'terminal' },
  { key: 'editor', label: 'Editor', icon: 'code' },
  { key: 'browser', label: 'Browser', icon: 'globe' },
  { key: 'preview', label: 'Preview', icon: 'monitor' },
  { key: 'db', label: 'Database', icon: 'db' },
  { key: 'events', label: 'Events', icon: 'list' },
  { key: 'artifacts', label: 'Artifacts', icon: 'folder' },
];
const ARTIFACT_ICON: Record<ArtifactKind, string> = {
  pr: 'branch', preview: 'globe', test: 'flask', schema: 'db', diff: 'code', file: 'doc', screenshot: 'image',
};

export function ComputerPanel({
  state, status, activeTab, onTab, events, onSelectFile, expanded, onExpand,
}: {
  state: FoldedState; status: string; activeTab: string; onTab: (t: string) => void;
  events: SessionEvent[]; onSelectFile: (path: string) => void;
  expanded?: boolean; onExpand?: () => void;
}) {
  const now = status === 'done'
    ? <><Icon name="check" className="st-ok" /><span>Task completed</span></>
    : status === 'failed'
      ? <><Icon name="xc" className="st-bad" /><span>Stopped — see the last message</span></>
      : lastActionLabel(state);

  return (
    <>
      <div className="comp-h">
        <span className="ttl"><Icon name="monitor" />Agent’s computer</span>
        <span style={{ flex: 1 }} />
        {onExpand && <button className="icon-btn hide-sm" aria-label="Expand" onClick={onExpand}><Icon name="max" /></button>}
      </div>
      <div className="now">{now}</div>
      <div className="ctabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} className={`ctab ${activeTab === t.key ? 'on' : ''}`} role="tab" onClick={() => onTab(t.key)}>
            <Icon name={t.icon} />{t.label}
          </button>
        ))}
      </div>
      {activeTab === 'terminal' && (
        <div className="cbody"><div className="term">
          {state.term.length === 0 && <span className="muted">Terminal is idle.</span>}
          {state.term.map((l, i) => <div key={i} className={l.stream === 'stderr' ? 'stderr' : 'out'}>{l.text}</div>)}
        </div></div>
      )}
      {activeTab === 'editor' && (
        state.currentFile ? (
          <>
            <div className="ftabs">
              {state.fileOrder.map((p) => (
                <button key={p} className={`ftab ${p === state.currentFile ? 'on' : ''}`} onClick={() => onSelectFile(p)}>{p.split('/').pop()}</button>
              ))}
            </div>
            <div className="cbody"><div className="ed">{state.files[state.currentFile]?.content}</div></div>
          </>
        ) : <div className="cbody plain"><div className="empty"><Icon name="code" /><b>No file open</b>Files the agent reads or edits appear here.</div></div>
      )}
      {activeTab === 'browser' && (
        state.browserUrl ? (
          <div className="browser">
            <div className="urlbar"><span className="u"><Icon name="lock" />{state.browserUrl}</span></div>
            <div className="viewport">
              {state.screenshotUrl
                ? <img src={state.screenshotUrl} alt="Browser screenshot" style={{ width: '100%' }} />
                : <div className="empty"><Icon name="image" /><b>No screenshot yet</b></div>}
            </div>
          </div>
        ) : <div className="cbody plain"><div className="empty"><Icon name="globe" /><b>Browser not opened</b>Pages the agent visits show up here.</div></div>
      )}
      {activeTab === 'preview' && (
        state.previewUrl ? (
          <div className="browser">
            <div className="urlbar">
              <span className="u"><Icon name="lock" />{state.previewUrl}</span>
              <a className="icon-btn" aria-label="Open in new tab" href={withScheme(state.previewUrl)} target="_blank" rel="noopener noreferrer"><Icon name="ext" /></a>
            </div>
            <iframe title="Preview" src={withScheme(state.previewUrl)} style={{ flex: 1, border: 0, background: '#fff' }} />
          </div>
        ) : <div className="cbody plain"><div className="empty"><Icon name="rocket" /><b>No preview yet</b>The agent deploys one once tests pass.</div></div>
      )}
      {activeTab === 'db' && (
        state.db ? (
          <div className="cbody plain">
            <div className="pad">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <Icon name="db" /><b style={{ fontWeight: 500 }}>{state.db.status}</b>
                <span className={`badge ${state.db.applied ? 'ok' : 'warn'}`}>{state.db.applied ? 'Applied' : 'Dry run'}</span>
              </div>
              <pre className="term" style={{ background: 'var(--code)', borderRadius: 10, border: '1px solid var(--card-line)' }}>{state.db.sql}</pre>
            </div>
            <div className="tbl-schema" style={{ paddingTop: 0 }}>
              {state.db.tables.map((t) => (
                <div className="card" key={t.name}>
                  <b><Icon name="db" />{t.name}</b>
                  {t.columns.map((c) => <div className="col" key={c.name}><span>{c.name}</span><small>{c.type}</small></div>)}
                </div>
              ))}
            </div>
          </div>
        ) : <div className="cbody plain"><div className="empty"><Icon name="db" /><b>No database activity</b>Schemas, dry-runs and queries appear here.</div></div>
      )}
      {activeTab === 'events' && (
        <div className="cbody"><div className="evs">
          <div className="note">Every event is saved before it is sent. Replaying a session folds these from #001.</div>
          {events.slice().reverse().map((e) => (
            <div className="evt" key={e.seq}>
              <span className="n">{String(e.seq + 1).padStart(3, '0')}</span>
              <span className="t">{new Date(e.ts).toLocaleTimeString()}</span>
              <span className="ty">{e.type}</span>
              <span className="sm">{summarize(e)}</span>
            </div>
          ))}
        </div></div>
      )}
      {activeTab === 'artifacts' && (
        state.artifacts.length ? (
          <div className="cbody plain">
            {state.artifacts.map((a) => (
              <div className="art-row" key={a.id}>
                <span className="ico-sq"><Icon name={ARTIFACT_ICON[a.kind]} /></span>
                <span className="txt"><b>{a.title}</b><small>{a.meta}</small></span>
              </div>
            ))}
          </div>
        ) : <div className="cbody plain"><div className="empty"><Icon name="folder" /><b>No artifacts yet</b>Files, diffs, PRs and reports show up here as they are created.</div></div>
      )}
    </>
  );
}

function lastActionLabel(state: FoldedState) {
  const lastAct = [...state.thread].reverse().find((t) => t.kind === 'act');
  if (!lastAct || lastAct.kind !== 'act') return <span>Getting ready…</span>;
  return <><span>The agent is using</span><b>{TOOL_LABEL[lastAct.tool]}</b><span className="tg">{lastAct.target}</span></>;
}

function withScheme(url: string) { return /^https?:/.test(url) ? url : `https://${url}`; }

function summarize(e: SessionEvent): string {
  switch (e.type) {
    case 'plan.updated': return `${e.payload.todos.length} todos`;
    case 'thought': return e.payload.text.slice(0, 64);
    case 'action.started': return `${e.payload.verb} · ${e.payload.target}`;
    case 'terminal.stdout': case 'terminal.stderr': return e.payload.line;
    case 'file.created': case 'file.modified': case 'file.deleted': return e.payload.path;
    case 'browser.navigate': return e.payload.url;
    case 'db.query': case 'db.schema': return e.payload.status ?? '';
    case 'approval.requested': return e.payload.title;
    case 'approval.resolved': return `${e.payload.decision} by you`;
    case 'artifact.created': return e.payload.title;
    case 'deploy.preview_url': return e.payload.url;
    case 'session.done': return 'Task completed';
    case 'error': return e.payload.message;
    default: return '';
  }
}
