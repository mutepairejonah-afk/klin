import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { RoleBar, ThreadPanel } from '@/components/ThreadPanel';
import { PlanCard } from '@/components/PlanCard';
import { ComputerPanel } from '@/components/ComputerPanel';
import { ConnectorPicker } from '@/components/ConnectorPicker';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useSessionEvents } from '@/hooks/useSessionEvents';
import { sessionsApi, connectionsApi } from '@/lib/api';
import { SessionViewSkeleton } from '@/components/Skeleton';
import { statusFromFold, type FoldedState } from '@/lib/sessionReducer';
import { fmtDuration } from '@/lib/format';
import type { Session, Connector } from '@/lib/types';

export function SessionView({ mode }: { mode: 'live' | 'replay' }) {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast((s) => s.show);
  const [meta, setMeta] = useState<Session | null>(null);
  const [metaError, setMetaError] = useState(false);
  const [tab, setTab] = useState('terminal');
  const [follow, setFollow] = useState(true);
  const [showCompMobile, setShowCompMobile] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [compMode, setCompMode] = useState<'normal' | 'min' | 'full'>('normal');

  const { visibleEvents, state, cursor, setCursor, maxCursor, approve, sendMessage } =
    useSessionEvents(id, { mode });

  useEffect(() => {
    sessionsApi.get(id).then(setMeta).catch(() => setMetaError(true));
    connectionsApi.list().then(setConnectors).catch(() => setConnectors([]));
  }, [id]);

  const status = meta ? statusFromFold(state, meta.status) : 'planning';
  const displayState = selectedFile && state.files[selectedFile] ? { ...state, currentFile: selectedFile } : state;
  const activeTab = follow ? lastToolTab(state) ?? tab : tab;
  // Only show the "Agent's computer" panel once the agent actually used a real
  // tool (search, terminal, editor, ...) — a plain chat/research answer that
  // only ever "thinks" (tool: 'model') has nothing to show there.
  const hasComp = visibleEvents.some((e) => e.type === 'action.started' && (e as any).payload?.tool && (e as any).payload.tool !== 'model');

  function selectTab(t: string) { setTab(t); setFollow(false); }
  function openComputer() {
    setFollow(true);
    setShowCompMobile(true);
  }
  async function send() {
    const text = message.trim();
    if (!text || sending || mode !== 'live') return;
    setSending(true);
    const accepted = await sendMessage(text);
    if (accepted) setMessage('');
    else toast('Message was not sent. Check the session and try again.');
    setSending(false);
  }

  if (metaError) {
    return (
      <div className="wrap">
        <div className="card empty"><div className="ico-sq"><Icon name="agent" /></div><b>Session not found</b>
          It may have been deleted, or you don’t have access to it.
          <div style={{ marginTop: 14 }}><Link className="btn pri" to="/sessions">All sessions</Link></div>
        </div>
      </div>
    );
  }
  if (!meta) return <SessionViewSkeleton />;

  return (
    <div className={`sess ${showCompMobile ? 'show-comp' : ''} ${compMode === 'full' ? 'comp-full' : ''} ${compMode === 'min' ? 'comp-min' : ''} ${hasComp ? 'has-comp' : ''}`}>
      <HeaderLeft><span className="h-title goal" title={meta.goal}>{meta.goal}</span></HeaderLeft>
      <HeaderRight>
        {status === 'executing' || status === 'planning' ? (
          <button className="btn sm" onClick={() => sessionsApi.pause(id).catch(() => toast('Request failed — check your connection or permissions'))}>
            <Icon name="pause" /><span className="hide-xs">Pause</span>
          </button>
        ) : status === 'paused' ? (
          <button className="btn sm" onClick={() => sessionsApi.resume(id).catch(() => toast('Request failed — check your connection or permissions'))}>
            <Icon name="play" /><span className="hide-xs">Resume</span>
          </button>
        ) : null}
        {hasComp && (
          <button className="btn sm only-m" aria-label="Toggle computer view" onClick={() => setShowCompMobile((v) => !v)}>
            <Icon name={showCompMobile ? 'list' : 'monitor'} /><span className="hide-xs">{showCompMobile ? 'Thread' : 'Computer'}</span>
          </button>
        )}
        {mode === 'live' && <Link className="btn sm hide-sm" to={`/s/${id}/replay`}><Icon name="play" />Replay</Link>}
        <button className="btn sm" onClick={() => setShareOpen(true)}><Icon name="share" /><span className="hide-xs">Share</span></button>
      </HeaderRight>

      <section className="thread-col">
        {hasComp && <RoleBar state={state} status={status} />}
        <div className="thr-scroll">
          <ThreadPanel goal={meta.goal} state={state} status={status} onTab={selectTab} onApprove={approve} />
        </div>
        {mode === 'live' && (
          <div className="dock">
            <div className="dock-col">
              <PlanCard state={state} status={status} onOpenComputer={openComputer} />
              <div className="composer steer slim">
                <textarea
                  rows={1} placeholder="Message Kiln"
                  value={message} onChange={(e) => setMessage(e.target.value)}
                  disabled={sending || state.followupActive}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                />
                <div className="bar">
                  <div className="l">
                    <button className="circle" aria-label="Attach" onClick={() => toast('Attach files')}><Icon name="plus" /></button>
                    <ConnectorPicker connectors={connectors} up />
                  </div>
                  <div className="r">
                    <button className="mic" aria-label="Voice" onClick={() => toast('Voice input')}><Icon name="mic" /></button>
                    <button type="button" className="send" aria-label="Send" disabled={sending || state.followupActive || !message.trim()} onClick={() => void send()}><Icon name="up" /></button>
                  </div>
                </div>
              </div>
              <div className="disclaimer">The agent can make mistakes. Please double-check before merging.</div>
            </div>
          </div>
        )}
      </section>

      <section className="comp-col">
        <div className="comp">
          <ComputerPanel
            state={displayState} status={status} activeTab={activeTab}
            onTab={(t) => { setTab(t); setFollow(false); }}
            events={visibleEvents}
            onSelectFile={(p) => { setSelectedFile(p); setTab('editor'); setFollow(false); }}
            expanded={compMode === 'full'} onExpand={() => setCompMode((m) => (m === 'full' ? 'normal' : 'full'))}
            minimized={compMode === 'min'} onMinimize={() => setCompMode((m) => (m === 'min' ? 'normal' : 'min'))}
          />
          {mode === 'replay' && (
            <div className="ctl">
              <button className="icon-btn" aria-label="Previous step" onClick={() => setCursor(Math.max(0, cursor - 1))}><Icon name="back" /></button>
              <button className="icon-btn" aria-label="Next step" onClick={() => setCursor(Math.min(maxCursor, cursor + 1))}><Icon name="fwd" /></button>
              <div className="scrubw">
                <input type="range" min={0} max={maxCursor} value={cursor} onChange={(e) => setCursor(Number(e.target.value))} aria-label="Session timeline" />
              </div>
              <span className="tm">{fmtDuration(state.elapsedSec)}</span>
            </div>
          )}
        </div>
      </section>

      {shareOpen && (
        <Modal onClose={() => setShareOpen(false)}>
          <h2>Share this session</h2>
          <p className="s">Anyone with the link can replay the plan, terminal, files and artifacts. Secrets are redacted.</p>
          <ShareLinkForm sessionId={id} onClose={() => setShareOpen(false)} />
        </Modal>
      )}
    </div>
  );
}

function ShareLinkForm({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { sessionsApi.share(sessionId).then((r) => setUrl(r.url)).catch(() => setUrl(null)); }, [sessionId]);
  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input w mono" style={{ fontSize: 12.5 }} readOnly value={url ?? 'Not connected yet'} aria-label="Share link" />
        <button className="btn pri" onClick={() => { if (url) { navigator.clipboard?.writeText(url); toast('Link copied'); } }}>
          <Icon name="link" />Copy link
        </button>
      </div>
      <div className="foot"><button className="btn" onClick={onClose}>Done</button></div>
    </>
  );
}

const TOOL_TAB: Record<string, string> = {
  terminal: 'terminal', editor: 'editor', browser: 'browser', preview: 'preview', db: 'db',
  deploy: 'preview', git: 'terminal', github: 'terminal', tests: 'terminal',
};

function lastToolTab(state: FoldedState): string | null {
  const lastAct = [...state.thread].reverse().find((t) => t.kind === 'act');
  if (!lastAct || lastAct.kind !== 'act') return null;
  return TOOL_TAB[lastAct.tool] ?? 'terminal';
}
