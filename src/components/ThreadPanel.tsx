import Icon from './Icon';
import type { FoldedState, ThreadItem } from '@/lib/sessionReducer';
import { TOOL_ICON } from '@/lib/toolMeta';
import { fmtDuration } from '@/lib/format';
import { ArtifactCard } from './DesignPreview';
import type { PreviewItem } from '@/lib/previews';

const ROLE_ORDER = ['planner', 'executor', 'critic', 'retriever'] as const;
const PHASES: [string, string][] = [
  ['planning', 'Plan'], ['executing', 'Execute'], ['approval', 'Approve'], ['verifying', 'Verify'], ['done', 'Done'],
];

export function RoleBar({ state, status }: { state: FoldedState; status: string }) {
  const phase = status === 'waiting_approval' ? 'approval' : status === 'failed' ? 'failed' : state.phase;
  const idx = phase === 'failed' ? 2 : PHASES.findIndex(([k]) => k === phase);
  return (
    <div className="rolebar">
      <div className="phases">
        {PHASES.map(([key, label], i) => (
          <span key={key}>
            <span className={`ph ${i < idx ? 'past' : ''} ${i === idx ? 'now' : ''} ${phase === 'failed' && i === idx ? 'bad' : ''}`}>
              {i < idx && <Icon name="check" />}
              {phase === 'failed' && i === idx ? 'Stopped' : label}
            </span>
            {i < PHASES.length - 1 && <span className="phl" />}
          </span>
        ))}
      </div>
      {status !== 'done' && status !== 'failed' && (
      <div className="roles">
        {ROLE_ORDER.map((r) => (
          <span key={r} className={`role-chip ${state.role === r && status !== 'done' && status !== 'failed' ? 'on' : ''}`}>
            <i />{r[0].toUpperCase() + r.slice(1)}
          </span>
        ))}
      </div>
      )}
    </div>
  );
}

function ThreadEntry({ item, onTab, onApprove }: {
  item: ThreadItem; onTab: (t: string) => void;
  onApprove: (id: string, decision: 'approved' | 'rejected') => void;
}) {
  if (item.kind === 'user') return <div className="umsg" style={{ marginTop: 8 }}><div className="bubble">{item.text}</div></div>;
  if (item.kind === 'thought') return <p className="th">{item.text}</p>;
  if (item.kind === 'act') return (
    <button className="act" onClick={() => onTab(item.tool)}>
      <Icon name={TOOL_ICON[item.tool]} />
      <span className="v">{item.verb}</span>
      <span className="tg">{item.target}</span>
      <span className={`role r-${item.role}`}>{item.role}</span>
    </button>
  );
  if (item.kind === 'verify') return (
    <div className="verify">
      <div className="vh"><Icon name="shield" className="st-ok" /><b style={{ fontWeight: 500 }}>Critic verified this step</b></div>
      <div className="chips">{item.checks.map((c) => (
        <span key={c.label} className={`badge ${c.passed ? 'ok' : 'bad'}`}><Icon name="check" />{c.label}</span>
      ))}</div>
    </div>
  );
  if (item.kind === 'error') {
    const f = friendlyError(item.message);
    return (
      <div className="errcard">
        <Icon name="alert" className="st-bad" />
        <div className="eb">
          <b>{f.title}</b>
          <p>{f.hint}</p>
          {f.raw && <details><summary>Technical details</summary><pre>{f.raw}</pre></details>}
        </div>
      </div>
    );
  }
  if (item.kind === 'approval') {
    const { approval: a, decision } = item;
    return (
      <div className={`approve ${decision !== 'pending' ? 'resolved' : ''}`}>
        <div className="ap-h">
          <Icon name="shield" className={decision === 'pending' ? 'st-warn' : 'st-ok'} />
          <b>{decision === 'pending' ? 'Approval needed' : decision === 'approved' ? 'Approved' : 'Rejected'}</b>
          {decision === 'pending' && <span className="badge warn">Waiting for you</span>}
        </div>
        <p><b style={{ fontWeight: 500 }}>{a.title}</b><br /><span className="muted">{a.body}</span></p>
        {a.command && <pre className="term" style={{ background: 'var(--code)', borderRadius: 10, border: '1px solid var(--card-line)' }}>{a.command}</pre>}
        <dl className="kv">
          {a.rollback && <><dt>Rollback plan</dt><dd>{a.rollback}</dd></>}
          {a.blastRadius && <><dt>Blast radius</dt><dd>{a.blastRadius}</dd></>}
        </dl>
        {decision === 'pending' && (
          <div className="ap-a">
            <button className="btn pri" onClick={() => onApprove(a.id, 'approved')}>Approve</button>
            <button className="btn" onClick={() => onApprove(a.id, 'rejected')}>Reject</button>
          </div>
        )}
      </div>
    );
  }
  // done
  return <p className="th">{item.text}</p>;
}

export function ThreadPanel({
  goal, state, status, onTab, onApprove, previews = [], openPreviewId = null, onTogglePreview,
}: {
  goal: string; state: FoldedState; status: string; onTab: (t: string) => void;
  onApprove: (id: string, decision: 'approved' | 'rejected') => void;
  previews?: PreviewItem[]; openPreviewId?: string | null; onTogglePreview?: (id: string) => void;
}) {
  const pr = state.artifacts.find((a) => a.kind === 'pr');
  const showThinking = (status === 'executing' || status === 'planning') && state.thread[state.thread.length - 1]?.kind !== 'act';
  return (
    <div className="thr">
      <div className="umsg"><div className="bubble">{goal}</div></div>
      <div className="statusline">{status === 'done' || status === 'failed' ? 'Worked for ' : 'Working for '}{fmtDuration(state.elapsedSec)}</div>
      {state.thread.map((item, i) => <ThreadEntry key={i} item={item} onTab={onTab} onApprove={onApprove} />)}
      {onTogglePreview && previews.map((p) => (
        <ArtifactCard key={p.id} item={p} open={openPreviewId === p.id} onToggle={() => onTogglePreview(p.id)} />
      ))}
      {pr && (
        <div className="pr-card">
          <span className="ico-sq"><Icon name="branch" /></span>
          <span className="txt"><b>{pr.title}</b><small>{pr.meta}</small></span>
          {pr.url && <a className="btn sm" href={pr.url} target="_blank" rel="noopener noreferrer"><Icon name="ext" />View PR</a>}
        </div>
      )}
      {showThinking && (
        <div className="thinking">{MARK_INLINE}<span className="shimmer">Thinking</span></div>
      )}
      {state.finished && (
        <div className="actions">
          <button className="icon-btn" aria-label="Copy"><Icon name="copy" /></button>
          <button className="icon-btn" aria-label="Retry"><Icon name="retry" /></button>
        </div>
      )}
    </div>
  );
}

const MARK_INLINE = (
  <span className="mk live">
    <svg viewBox="0 0 32 32"><rect x="3.5" y="3.5" width="25" height="25" rx="8" fill="none" stroke="currentColor" strokeWidth={1.6} />
      <path d="m11 12.5 5 3.5-5 3.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
  </span>
);

function friendlyError(message: string): { title: string; hint: string; raw?: string } {
  const m = message || '';
  if (/429|rate.?limit|quota/i.test(m)) {
    return { title: 'The AI provider is rate-limited', hint: 'The free model quota is used up for now. Try again in a few minutes, or add credits / another provider in Settings.', raw: m };
  }
  if (/All AI providers failed/i.test(m)) {
    return { title: 'No AI provider could answer', hint: 'Every configured model failed. Check the provider keys and model names in Settings, then retry.', raw: m };
  }
  if (m.length > 140) return { title: 'Something went wrong', hint: 'The agent stopped before finishing.', raw: m };
  return { title: m || 'Something went wrong', hint: 'The agent stopped before finishing.' };
}
