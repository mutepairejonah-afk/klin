import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { ConnectorPicker } from '@/components/ConnectorPicker';
import { RepoPicker, BranchPicker } from '@/components/RepoPicker';
import { JOB_TEMPLATES, jobById } from '@/lib/jobs';
import { useUiStore } from '@/lib/store';
import { sessionsApi, connectionsApi } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { loadSpecialists, loadPrompt, type Specialist } from '@/lib/agents';
import type { Connector } from '@/lib/types';

export default function AiAgent() {
  const nav = useNavigate();
  const toast = useToast((s) => s.show);
  const { draft, setDraft, selectedJobId, setSelectedJobId, selectedConnectors, repo, branch, setRepo, setBranch, selectedAgent, setSelectedAgent } = useUiStore();
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [starting, setStarting] = useState(false);
  const [specialistError, setSpecialistError] = useState(false);
  const [connectorError, setConnectorError] = useState(false);
  const [specialistLoading, setSpecialistLoading] = useState(true);
  const [connectorLoading, setConnectorLoading] = useState(true);
  const [slashOpen, setSlashOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  function refreshSpecialists() {
    setSpecialistLoading(true);
    loadSpecialists().then((catalog) => { setSpecialists(catalog.agents); setSpecialistError(false); })
      .catch(() => setSpecialistError(true))
      .finally(() => setSpecialistLoading(false));
  }

  function refreshConnectors() {
    setConnectorLoading(true);
    connectionsApi.list().then((items) => { setConnectors(items); setConnectorError(false); })
      .catch(() => setConnectorError(true))
      .finally(() => setConnectorLoading(false));
  }

  useEffect(() => { refreshSpecialists(); refreshConnectors(); }, []);

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
  const connectedConnectorCount = connectors.filter((connector) => connector.connected).length;
  const selectedTaskConnectors = connectors.filter((connector) => connector.connected && selectedConnectors.includes(connector.id));
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
    if (starting) return;
    if (!goal || goal === '/') { toast('Describe what you want the agent to do'); return; }
    if (connectorError && selectedConnectors.length) { toast('Refresh connector status before using an integration for this task.'); return; }
    setStarting(true);
    try {
      let persona: { slug: string; name: string; systemPrompt: string } | undefined;
      if (agent) {
        try {
          persona = { slug: agent.slug, name: agent.name, systemPrompt: await loadPrompt(agent.slug) };
        } catch {
          toast(`Couldn’t load ${agent.name}'s specialist instructions. Retry or choose another specialist.`);
          return;
        }
      }
      const session = await sessionsApi.create({ goal, jobId: selectedJobId, repo, branch, connectors: selectedConnectors, agent: persona });
      setDraft(''); setSelectedJobId(null); setSelectedAgent(null);
      nav(`/s/${session.id}`);
    } catch {
      toast('Request failed — check your connection or permissions');
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <HeaderLeft><span className="h-title">AI Agent</span></HeaderLeft>
      <HeaderRight />
      <div className="home agent-home">
        <div className="hero-wrap">
          <span className="eyebrow"><i />Autonomous coding agent</span>
          <h1 className="hero">Talk to the <em>agent</em></h1>
          <p className="hero-sub">Type <span className="mono">/</span> for a job type or one of 279 specialists, or just describe the work.</p>
        </div>

        {specialistError && (
          <div className="connector-notice" role="alert">
            <span className="notice-icon"><Icon name="alert" /></span>
            <div><b>Specialist catalog unavailable</b><p>The default Agent still works; specialist choices need their catalog to load.</p></div>
            <button type="button" className="btn sm" disabled={specialistLoading} onClick={refreshSpecialists}><Icon name="retry" /> Retry</button>
          </div>
        )}
        {connectorError && (
          <div className="connector-notice" role="alert">
            <span className="notice-icon"><Icon name="alert" /></span>
            <div><b>Connector status unavailable</b><p>This task will not have integration access until connection status can be loaded.</p></div>
            <button type="button" className="btn sm" disabled={connectorLoading} onClick={refreshConnectors}><Icon name="retry" /> Retry</button>
          </div>
        )}

        <div className="composer" ref={wrapRef}>
          {slashOpen && (
            <div className="menu up slash-menu" role="menu" style={{ position: 'absolute', left: 14, right: 14 }}>
              <div className="mh">Job types</div>
              {specialistLoading && <div className="muted" style={{ padding: '9px 10px' }}>Loading specialists…</div>}
              {!specialistLoading && !specialistError && filteredJobs.length === 0 && filteredAgents.length === 0 && <div className="muted" style={{ padding: '9px 10px' }}>No match</div>}
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
          <div className="agent-integrations">
            <div className="agent-integrations-copy">
              <span className="agent-integrations-title"><Icon name="plug" />Apps for this task</span>
              <span className="agent-integrations-help">
                {connectorError ? 'Connector status unavailable' : connectorLoading ? 'Checking connected apps…' : connectedConnectorCount ? `${connectedConnectorCount} connected — choose what the agent can use` : 'Connect an app to give the agent access'}
              </span>
            </div>
            <ConnectorPicker connectors={connectors} up showLabel />
          </div>
          {selectedTaskConnectors.length > 0 && (
            <div className="agent-integrations-selected" aria-label="Integrations selected for this task">
              {selectedTaskConnectors.map((connector) => <span className="agent-integration-chip" key={connector.id}><Icon name="check" />{connector.name}</span>)}
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
              {selectedConnectors.includes('github') && (
                <>
                  <RepoPicker
                    repo={repo}
                    connected={!!connectors.find((c) => c.id === 'github')?.connected}
                    onPick={(r, b) => { setRepo(r); setBranch(b); }}
                  />
                  <BranchPicker repo={repo} branch={branch} onPick={setBranch} />
                </>
              )}
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
              <button className="send" aria-label={starting ? 'Starting task' : 'Start task'} disabled={starting || !draft.trim()} onClick={send}>{starting ? <span className="spin" /> : <Icon name="up" />}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
