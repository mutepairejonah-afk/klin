import { useState } from 'react';
import Icon from './Icon';
import type { FoldedState } from '@/lib/sessionReducer';

const MARK = (
  <span className="mk live">
    <svg viewBox="0 0 32 32"><rect x="3.5" y="3.5" width="25" height="25" rx="8" fill="none" stroke="currentColor" strokeWidth={1.6} />
      <path d="m11 12.5 5 3.5-5 3.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
  </span>
);

// The status card above the composer: live thumbnail + "Thinking…" /
// "Working: <step>" + the collapsible todo list. Mirrors the plan's
// "Plan panel" + a snapshot of the Computer view so progress is visible
// without switching panels (useful on mobile, where they're tabs).
export function PlanCard({
  state, status, onOpenComputer,
}: { state: FoldedState; status: string; onOpenComputer: () => void }) {
  const [open, setOpen] = useState(false);
  const cur = state.activeIndex >= 0 ? state.todos[state.activeIndex]?.label : 'All steps complete';

  const thumbText = state.currentFile && state.files[state.currentFile]
    ? state.files[state.currentFile].content
    : state.term.length ? state.term.map((l) => l.text).join('\n') : '';

  let head: JSX.Element;
  if (status === 'failed') head = <><span className="err"><Icon name="xc" />Couldn’t finish</span><span className="cur" /></>;
  else if (status === 'waiting_approval') head = <>{<Icon name="shield" className="st-warn" />}<span className="cur">Waiting for your approval</span></>;
  else if (status === 'done') head = <>{<Icon name="check" className="st-ok" />}<span className="cur">Task completed</span></>;
  else head = <>{status === 'paused' ? <Icon name="pause" /> : MARK}
    <span className={`wk ${status === 'executing' || status === 'planning' ? 'shimmer' : ''}`}>{status === 'paused' ? 'Paused' : 'Working'}</span>
    <span className="cur muted">{cur}</span></>;

  const showThumb = thumbText && (status === 'executing' || status === 'planning' || status === 'waiting_approval');

  return (
    <div className={`plan-card ${open ? 'open' : ''}`}>
      <div className="todos">
        {state.todos.map((t, i) => (
          <div key={t.id} className={`todo ${t.done ? 'done' : i === state.activeIndex && status !== 'done' ? 'active' : ''}`}>
            <span className="ck">{t.done ? <Icon name="check" /> : null}</span>
            <span>{t.label}</span>
          </div>
        ))}
      </div>
      <div className="plan-top">
        {showThumb && (
          <button className="thumb-live" aria-label="Show the agent's computer" onClick={onOpenComputer}>
            <pre>{thumbText.split('\n').slice(-10).map((l) => l.slice(0, 44)).join('\n')}</pre>
          </button>
        )}
        <button className="plan-h" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {head}
          <span className="n">{state.todos.filter((t) => t.done).length} / {state.todos.length}</span>
          <span className="chev"><Icon name="chev" /></span>
        </button>
      </div>
    </div>
  );
}
