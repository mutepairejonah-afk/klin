import Icon from './Icon';
import type { FoldedState, ThreadItem } from '@/lib/sessionReducer';
import { TOOL_ICON } from '@/lib/toolMeta';
import { fmtDuration } from '@/lib/format';

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
      <div className="roles">
        {ROLE_ORDER.map((r) => (
          <span key={r} className={`role-chip ${state.role === r && status !== 'done' && status !== 'failed' ? 'on' : ''}`}>
            <i />{r[0].toUpperCase() + r.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}

function ThreadEntry({ item, onTab, onApprove }: {
  item: ThreadItem; onTab: (t: string) => void;
  onApprove: (id: string, decision: 'approved' | 'rejected') => void;
}) {
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
  if (item.kind === 'error') return (
    <div className="verify" style={{ borderColor: 'color-mix(in srgb, var(--red) 35%, var(--card-line))', background: 'color-mix(in srgb, var(--red) 5%, var(--card))' }}>
      <div className="vh"><Icon name="xc" className="st-bad" /><b style={{ fontWeight: 500 }}>{item.message}</b></div>
    </div>
  );
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
  goal, state, status, onTab, onApprove, extraMessages,
}: {
  goal: string; state: FoldedState; status: string; onTab: (t: string) => void;
  onApprove: (id: string, decision: 'approved' | 'rejected') => void; extraMessages: string[];
}) {
  const pr = state.artifacts.find((a) => a.kind === 'pr');
  const showThinking = (status === 'executing' || status === 'planning') && state.thread[state.thread.length - 1]?.kind !== 'act';
  return (
    <div className="thr">
      <div className="umsg"><div className="bubble">{goal}</div></div>
      <div className="statusline">{status === 'done' || status === 'failed' ? 'Worked for ' : 'Working for '}{fmtDuration(state.elapsedSec)}</div>
      {state.thread.map((item, i) => <ThreadEntry key={i} item={item} onTab={onTab} onApprove={onApprove} />)}
      {pr && (
        <div className="pr-card">
          <span className="ico-sq"><Icon name="branch" /></span>
          <span className="txt"><b>{pr.title}</b><small>{pr.meta}</small></span>
          {pr.url && <a className="btn sm" href={pr.url} target="_blank" rel="noopener noreferrer"><Icon name="ext" />View PR</a>}
        </div>
      )}
      {extraMessages.map((m, i) => (
        <div key={i}>
          <div className="umsg" style={{ marginTop: 8 }}><div className="bubble">{m}</div></div>
          <p className="th">Got it. I’ll factor that into the next step.</p>
        </div>
      ))}
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
