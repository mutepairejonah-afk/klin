import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { ConnectorPicker } from '@/components/ConnectorPicker';
import { JOB_TEMPLATES, jobById } from '@/lib/jobs';
import { useUiStore } from '@/lib/store';
import { sessionsApi, connectionsApi } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { loadSpecialists, loadPrompt, type Specialist } from '@/lib/agents';
import type { Connector } from '@/lib/types';

export default function AiAgent() {
  const nav = useNavigate();
  const toast = useToast((s) => s.show);
  const { draft, setDraft, selectedJobId, setSelectedJobId, selectedConnectors, repo, branch, selectedAgent, setSelectedAgent } = useUiStore();
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [starting, setStarting] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadSpecialists().then((c) => setSpecialists(c.agents)).catch(() => setSpecialists([])); }, []);
  useEffect(() => { connectionsApi.list().then(setConnectors).catch(() => setConnectors([])); }, []);

  useEffect(() => {
    if (!slashOpen) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setSlashOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [slashOpen]);

  const job = jobById(selectedJobId);
  const slashMatch = /^\/(.*)$/.exec(draft);
  const query = slashMatch ? slashMatch[1].toLowerCase() : '';
  const filteredJobs = slashMatch ? JOB_TEMPLATES.filter((j) => j.name.toLowerCase().includes(query)) : [];

  const agent = specialists.find((a) => a.slug === selectedAgent) ?? null;
  const filteredAgents = slashMatch
    ? specialists.filter((a) => `${a.name} ${a.description}`.toLowerCase().includes(query)).slice(0, query ? 12 : 8)
    : [];

  function pickAgent(slug: string) {
    setSelectedAgent(slug);
    setDraft('');
    setSlashOpen(false);
    taRef.current?.focus();
  }

  function onChange(v: string) {
    setDraft(v);
    setSlashOpen(/^\/(.*)$/.test(v));
  }

  function pickJob(id: string) {
    setSelectedJobId(id);
    setDraft('');
    setSlashOpen(false);
    taRef.current?.focus();
  }

  async function send() {
    const goal = draft.trim();
    if (!goal || goal === '/') { toast('Describe what you want the agent to do'); return; }
    setStarting(true);
    try {
      let persona: { slug: string; name: string; systemPrompt: string } | undefined;
      if (agent) persona = { slug: agent.slug, name: agent.name, systemPrompt: await loadPrompt(agent.slug) };
      const session = await sessionsApi.create({ goal, jobId: selectedJobId, repo, branch, connectors: selectedConnectors, agent: persona });
      setDraft(''); setSelectedJobId(null); setSelectedAgent(null);
      nav(`/s/${session.id}`);
    } catch {
      toast('Backend not connected yet');
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <HeaderLeft><span className="h-title">AI Agent</span></HeaderLeft>
      <HeaderRight />
      <div className="home">
        <div className="hero-wrap">
          <span className="eyebrow"><i />Autonomous coding agent</span>
          <h1 className="hero">Talk to the <em>agent</em></h1>
          <p className="hero-sub">Type <span className="mono">/</span> for a job type or one of 279 specialists, or just describe the work.</p>
        </div>

        <div className="composer" ref={wrapRef}>
          {slashOpen && (
            <div className="menu up slash-menu" role="menu" style={{ position: 'absolute', left: 14, right: 14 }}>
              <div className="mh">Job types</div>
              {filteredJobs.length === 0 && filteredAgents.length === 0 && <div className="muted" style={{ padding: '9px 10px' }}>No match</div>}
              {filteredJobs.map((j) => (
                <button key={j.id} role="menuitem" onClick={() => pickJob(j.id)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon name={j.icon} />{j.name}</span>
                  <small>{j.inputLabel} → {j.outputLabel}</small>
                </button>
              ))}
              {filteredAgents.length > 0 && <div className="mh">Specialists</div>}
              {filteredAgents.map((a) => (
                <button key={a.slug} role="menuitem" onClick={() => pickAgent(a.slug)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span aria-hidden>{a.emoji}</span>{a.name}</span>
                  <small>{a.vibe || a.description}</small>
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={taRef}
            rows={2}
            placeholder={job ? job.placeholder : 'Message the agent, or type / for a job type or specialist'}
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && slashOpen) { setSlashOpen(false); return; }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (slashOpen && filteredJobs.length) pickJob(filteredJobs[0].id);
                else if (slashOpen && filteredAgents.length) pickAgent(filteredAgents[0].slug);
                else send();
              }
            }}
          />
          <div className="bar">
            <div className="l">
              <button className="circle" aria-label="Attach a ZIP or files" onClick={() => toast('Attach ZIP or files')}><Icon name="plus" /></button>
              <ConnectorPicker connectors={connectors} />
              {job && (
                <span className="pill tag">
                  <Icon name={job.icon} />{job.name}
                  <button className="x" aria-label="Remove job type" onClick={() => setSelectedJobId(null)}><Icon name="x" /></button>
                </span>
              )}
              {agent && (
                <span className="pill tag">
                  <span aria-hidden>{agent.emoji}</span>{agent.name}
                  <button className="x" aria-label="Remove specialist" onClick={() => setSelectedAgent(null)}><Icon name="x" /></button>
                </span>
              )}
            </div>
            <div className="r">
              <button className="mic" aria-label="Voice input" onClick={() => toast('Voice input')}><Icon name="mic" /></button>
              <button className="send" aria-label="Send" disabled={starting} onClick={send}><Icon name="up" /></button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
