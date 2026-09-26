import { useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { ConnectorPicker } from '@/components/ConnectorPicker';
import { useUiStore } from '@/lib/store';
import { jobById } from '@/lib/jobs';
import { useSessions } from '@/hooks/useSessions';
import { sessionsApi, connectionsApi } from '@/lib/api';
import { useToast } from '@/components/Toast';
import type { Connector } from '@/lib/types';
import { useEffect } from 'react';

export default function Home() {
  const nav = useNavigate();
  const toast = useToast((s) => s.show);
  const { draft, setDraft, selectedJobId, setSelectedJobId, selectedConnectors, repo, branch, setRepo, setBranch } = useUiStore();
  const { sessions } = useSessions();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [starting, setStarting] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { connectionsApi.list().then(setConnectors).catch(() => setConnectors([])); }, []);

  const job = jobById(selectedJobId);
  const working = sessions.filter((s) => s.status === 'executing' || s.status === 'planning' || s.status === 'waiting_approval');
  const recent = sessions.slice(0, 4);

  async function start() {
    const goal = draft.trim();
    if (!goal) { toast('Describe the job first'); return; }
    setStarting(true);
    try {
      const session = await sessionsApi.create({ goal, jobId: selectedJobId, repo, branch, connectors: selectedConnectors });
      setDraft(''); setSelectedJobId(null);
      nav(`/s/${session.id}`);
    } catch {
      toast('Backend not connected yet');
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <HeaderLeft><span className="h-title">Balanced ⌄</span></HeaderLeft>
      <HeaderRight />
      <div className="home">
        <div className="hero-wrap">
          <span className="eyebrow"><i />Autonomous coding agent</span>
          <h1 className="hero">What are we <em>shipping</em>?</h1>
          <p className="hero-sub">Hand it a goal. Get back a pull request.</p>
        </div>

        <div className="composer">
          <textarea
            ref={taRef}
            rows={2}
            placeholder={job ? job.placeholder : 'Describe a coding job, or paste an issue link'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); start(); } }}
          />
          <div className="bar">
            <div className="l">
              <button className="circle" aria-label="Attach a ZIP or files" onClick={() => toast('Attach ZIP or files')}><Icon name="plus" /></button>
              <ConnectorPicker connectors={connectors} />
              {selectedConnectors.includes('github') && (
                <>
                  <span className="pill" onClick={() => { const r = prompt('Repository', repo); if (r != null) setRepo(r); }}>
                    <Icon name="folder" />{repo || 'Repository'}
                  </span>
                  <span className="pill" onClick={() => { const b = prompt('Branch', branch || 'main'); if (b != null) setBranch(b); }}>
                    <Icon name="branch" />{branch || 'Branch'}
                  </span>
                </>
              )}
              {job && (
                <span className="pill tag">
                  <Icon name={job.icon} />{job.name}
                  <button className="x" aria-label="Remove job type" onClick={() => setSelectedJobId(null)}><Icon name="x" /></button>
                </span>
              )}
            </div>
            <div className="r">
              <button className="mic" aria-label="Voice input" onClick={() => toast('Voice input')}><Icon name="mic" /></button>
              <button className="send" aria-label="Start task" disabled={starting} onClick={start}><Icon name="up" /></button>
            </div>
          </div>
        </div>

        {working.length > 0 && (
          <section className="recent">
            <h3><span>Working now</span></h3>
            <div className="live-strip">
              {working.map((s) => (
                <a key={s.id} className="live-card" href={`/s/${s.id}`} onClick={(e) => { e.preventDefault(); nav(`/s/${s.id}`); }}>
                  <div className="lc-h"><Icon name="agent" /><b>{s.goal}</b></div>
                  <div className="hbar"><i style={{ width: s.status === 'waiting_approval' ? '100%' : '40%' }} /></div>
                  <div className="lc-m"><span className="mono">{s.repo || '—'}</span><span>{s.status === 'waiting_approval' ? 'Needs your approval' : 'Running'}</span></div>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="recent">
          <h3><span>Recent sessions</span><a href="/sessions" className="muted" onClick={(e) => { e.preventDefault(); nav('/sessions'); }}>View all</a></h3>
          <div className="card">
            {recent.length === 0 && <div className="muted" style={{ padding: '16px 18px' }}>No sessions yet</div>}
            {recent.map((s) => (
              <a key={s.id} className="rcard" href={`/s/${s.id}`} onClick={(e) => { e.preventDefault(); nav(`/s/${s.id}`); }}>
                <span className="task-ic"><Icon name="agent" /></span>
                <span className="txt"><b>{s.goal}</b><small>{s.repo || '—'} · {jobById(s.jobId)?.name ?? 'Job'} · {s.status}</small></span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
