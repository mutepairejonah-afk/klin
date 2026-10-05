import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { useToast } from '@/components/Toast';
import { CONNECTOR_CATALOG } from '@/lib/connectorCatalog';
import { connectionsApi } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { useUiStore } from '@/lib/store';
import type { Connector } from '@/lib/types';

const TABS = [
  { key: 'integrations', label: 'Integrations' },
  { key: 'tools', label: 'Built-in tools' },
] as const;

type Filter = 'all' | 'connected' | 'ready' | 'soon';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All integrations' },
  { key: 'connected', label: 'Connected' },
  { key: 'ready', label: 'Ready to connect' },
  { key: 'soon', label: 'In development' },
];

const TOOL_GROUPS = [
  {
    title: 'Workspace', icon: 'folder',
    tools: [
      { name: 'Filesystem', detail: 'Read, search, and edit files inside the isolated workspace', commands: 'read · write · list · patch · search', available: true },
      { name: 'Terminal', detail: 'Run bounded commands inside the isolated workspace', commands: 'exec · timeout · working directory', available: true },
      { name: 'Git', detail: 'Clone repositories and inspect branches/diffs; publishing requires approval', commands: 'clone · status · diff · branch · commit · push · PR', available: true },
    ],
  },
  {
    title: 'Research & data', icon: 'globe',
    tools: [
      { name: 'Browser', detail: 'Browser navigation and interactive page control are not enabled yet', commands: 'In development', available: false },
      { name: 'Database', detail: 'Database schema and query tools are not enabled yet', commands: 'In development', available: false },
    ],
  },
  {
    title: 'Ship with confidence', icon: 'rocket',
    tools: [
      { name: 'Tests', detail: 'Detect and run the project test command in the isolated workspace', commands: 'detect · run · parse results', available: true },
      { name: 'Deploy', detail: 'Preview deployments and deployment health checks are not enabled yet', commands: 'In development', available: false },
      { name: 'Secrets', detail: 'Secret injection into task workspaces is not enabled yet', commands: 'In development', available: false },
    ],
  },
];
const TOOL_COUNT = TOOL_GROUPS.flatMap((group) => group.tools);
const AVAILABLE_TOOL_COUNT = TOOL_COUNT.filter((tool) => tool.available).length;

function ConnectorMark({ id, name }: { id: string; name: string }) {
  return (
    <span className={`provider-mark provider-${id}`} aria-hidden="true">
      {id === 'github' ? <Icon name="gh" /> : id === 'supabase' ? <Icon name="spark" /> : id === 'vercel' ? <span className="vercel-mark" /> : name.slice(0, 1)}
    </span>
  );
}

function lastUsedLabel(value?: string) {
  if (!value) return 'Connected';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Connected';
  return `Last used ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export default function Connections() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'integrations';
  const toast = useToast((s) => s.show);
  const removeConnector = useUiStore((s) => s.removeConnector);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  function refresh() {
    connectionsApi.list()
      .then((data) => { setConnectors(data); setLoadError(false); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(); }, []);

  // Surface the OAuth callback once, then clean its parameters from the URL.
  useEffect(() => {
    const connected = params.get('connected');
    const error = params.get('error');
    if (connected) { toast(`Connected ${connected}`); refresh(); }
    if (error) {
      const messages: Record<string, string> = {
        github_not_configured: 'GitHub sign-in is not configured on the server yet.',
        github_state: 'The GitHub sign-in link expired. Please try again.',
        github_token: 'GitHub could not complete sign-in. Please try again.',
        github_save: 'GitHub signed in, but the connection could not be saved.',
      };
      toast(messages[error] ?? 'Connection failed. Please try again.');
    }
    if (connected || error) {
      const next = new URLSearchParams(params);
      next.delete('connected');
      next.delete('error');
      setParams(next, { replace: true });
    }
    // This should run only for the OAuth callback query on initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(() => new Map(connectors.map((connector) => [connector.id, connector])), [connectors]);
  const connectedCount = connectors.filter((connector) => connector.connected).length;
  const readyCount = CONNECTOR_CATALOG.filter((item) => byId.get(item.id)?.oauth && byId.get(item.id)?.oauthConfigured !== false && !byId.get(item.id)?.connected).length;
  const filteredCatalog = CONNECTOR_CATALOG.filter((item) => {
    const live = byId.get(item.id);
    const matchesFilter = filter === 'all'
      || (filter === 'connected' && !!live?.connected)
      || (filter === 'ready' && !!live?.oauth && live.oauthConfigured !== false && !live.connected)
      || (filter === 'soon' && !!live && !live.oauth);
    const matchesQuery = `${item.name} ${item.description} ${item.scopes.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesFilter && matchesQuery;
  });

  async function handleConnection(connector: Connector, connected: boolean) {
    if (!connector.oauth && !connected) return;
    setBusyId(connector.id);
    try {
      if (connected) {
        await connectionsApi.disconnect(connector.id);
        removeConnector(connector.id);
        toast(`Disconnected ${connector.name}`);
        refresh();
      } else {
        const { url } = await connectionsApi.githubOAuthUrl();
        window.location.href = url;
      }
    } catch {
      toast(connected ? `Couldn’t disconnect ${connector.name}. Try again.` : `${connector.name} sign-in isn’t available right now.`);
      setBusyId(null);
    }
  }

  return (
    <>
      <HeaderLeft><span className="h-title">Connectors</span></HeaderLeft>
      <HeaderRight />
      <div className="wrap connector-wrap">
        <div className="connector-hero">
          <div className="connector-hero-icon"><Icon name="plug" /></div>
          <div className="connector-hero-copy">
            <div className="connector-eyebrow">Your workspace, connected</div>
            <h1 className="h1">Connectors</h1>
            <p className="sub">Bring your tools into the work. Choose what Klin can access, and keep control of every connection.</p>
          </div>
        </div>

        <div className="connector-stats" aria-label="Integration summary">
          <div className="connector-stat"><span className="connector-stat-icon"><Icon name="link" /></span><div><b>{loading ? '—' : connectedCount}</b><small>Connected</small></div></div>
          <div className="connector-stat"><span className="connector-stat-icon"><Icon name="shield" /></span><div><b>{loading ? '—' : readyCount}</b><small>Ready to connect</small></div></div>
          <div className="connector-stat"><span className="connector-stat-icon"><Icon name="layers" /></span><div><b>{CONNECTOR_CATALOG.length}</b><small>Integrations</small></div></div>
        </div>

        <div className="tabs connector-tabs" role="tablist" aria-label="Connector sections">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={`tab ${tab === item.key ? 'on' : ''}`}
              onClick={() => setParams({ tab: item.key })}
            >
              {item.label}
              {item.key === 'integrations' && <span className="tab-count">{CONNECTOR_CATALOG.length}</span>}
            </button>
          ))}
        </div>

        {tab === 'integrations' && (
          <section role="tabpanel" aria-label="Integrations">
            <div className="integration-toolbar">
              <div className="integration-filter" role="group" aria-label="Filter integrations">
                {FILTERS.map((item) => (
                  <button key={item.key} type="button" className={filter === item.key ? 'selected' : ''} onClick={() => setFilter(item.key)}>
                    {item.label}
                    {item.key === 'connected' && <span>{loading ? '—' : connectedCount}</span>}
                    {item.key === 'ready' && <span>{loading ? '—' : readyCount}</span>}
                  </button>
                ))}
              </div>
              <label className="integration-search">
                <Icon name="search" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an integration" aria-label="Search integrations" />
                {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><Icon name="x" /></button>}
              </label>
            </div>

            {loadError && (
              <div className="connector-notice" role="status">
                <span className="notice-icon"><Icon name="alert" /></span>
                <div><b>Couldn’t load connection status</b><p>Check your connection and try again. Your existing integrations haven’t been changed.</p></div>
                <button type="button" className="btn sm" onClick={() => { setLoading(true); refresh(); }}><Icon name="retry" /> Retry</button>
              </div>
            )}

            {loading ? (
              <div className="integration-grid" aria-label="Loading integrations">
                {CONNECTOR_CATALOG.slice(0, 4).map((item) => <div className="integration-card loading-card" key={item.id}><Skeleton width={44} height={44} /><Skeleton width="42%" height={16} /><Skeleton width="82%" height={13} /><Skeleton width="30%" height={30} /></div>)}
              </div>
            ) : filteredCatalog.length ? (
              <div className="integration-grid">
                {filteredCatalog.map((item) => {
                  const live = byId.get(item.id);
                  const statusKnown = !!live;
                  const connected = !!live?.connected;
                  const ready = !!live?.oauth && live.oauthConfigured !== false;
                  const needsSetup = !!live?.oauth && live.oauthConfigured === false;
                  const meta = live?.meta;
                  const account = typeof meta === 'string' ? meta : meta?.login ? `Signed in as ${meta.login}` : 'Account connected';
                  return (
                    <article className={`integration-card ${connected ? 'is-connected' : ''}`} key={item.id}>
                      <div className="integration-card-top">
                        <ConnectorMark id={item.id} name={item.name} />
                        <span className={`connection-state ${connected ? 'state-connected' : !statusKnown ? 'state-unknown' : needsSetup ? 'state-soon' : ready ? 'state-ready' : 'state-soon'}`}>
                          <i />{connected ? 'Connected' : !statusKnown ? 'Status unavailable' : needsSetup ? 'Server setup needed' : ready ? 'Ready to connect' : 'In development'}
                        </span>
                      </div>
                      <h2>{item.name}</h2>
                      <p className="integration-description">{item.description}</p>

                      {connected ? (
                        <div className="integration-account">
                          {typeof meta === 'object' && meta?.avatarUrl
                            ? <img src={meta.avatarUrl} alt="" />
                            : <span className="account-avatar"><Icon name="user" /></span>}
                          <div><b>{account}</b><small>{lastUsedLabel(live?.lastUsedAt)}</small></div>
                        </div>
                      ) : (
                        <div className="integration-scope-preview">
                          <span>Access includes</span>
                          <div className="scope-chips">{item.scopes.slice(0, 3).map((scope) => <span key={scope}>{scope}</span>)}</div>
                        </div>
                      )}

                      {connected && item.id === 'github' && live?.githubExecutionConfigured === false && (
                        <div className="connector-runtime-notice" role="status">
                          GitHub sign-in is active, but repository jobs are not enabled on this server. Configure <code>KILN_EXECUTION_ENABLED=true</code>, <code>ORCHESTRATOR_MODE=coding</code>, and an outbound-capable sandbox runtime/network.
                        </div>
                      )}

                      <div className="integration-card-footer">
                        {connected ? (
                          <>
                            <span className="connected-footnote"><Icon name="shield" /> Access is encrypted</span>
                            <button type="button" className="disconnect-button" disabled={busyId === item.id} onClick={() => live && handleConnection(live, true)}>
                              {busyId === item.id ? <><span className="spin" /> Working</> : 'Disconnect'}
                            </button>
                          </>
                        ) : !statusKnown ? (
                          <>
                            <span className="connected-footnote">Check connection status to continue</span>
                            <button type="button" className="btn sm coming-button" disabled>Unavailable</button>
                          </>
                        ) : needsSetup ? (
                          <>
                            <span className="connected-footnote">Add GitHub OAuth credentials to the backend</span>
                            <button type="button" className="btn sm coming-button" disabled>Needs setup</button>
                          </>
                        ) : ready ? (
                          <>
                            <span className="connected-footnote">Secure OAuth sign-in</span>
                            <button type="button" className="btn pri connect-button" disabled={busyId === item.id} onClick={() => live && handleConnection(live, false)}>
                              {busyId === item.id ? <><span className="spin" /> Connecting</> : <>Connect <Icon name="arrow" /></>}
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="connected-footnote">Provider setup is underway</span>
                            <button type="button" className="btn sm coming-button" disabled>Coming soon</button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="connector-empty">
                <span className="connector-empty-icon"><Icon name={query ? 'search' : 'filter'} /></span>
                <b>{query ? 'No matching integrations' : 'Nothing in this view yet'}</b>
                <p>{query ? 'Try another name or clear your search.' : 'Choose another filter to see your integrations.'}</p>
                <button type="button" className="btn sm" onClick={() => { setFilter('all'); setQuery(''); }}>Show all integrations</button>
              </div>
            )}

            <div className="connector-security-note"><Icon name="lock" /><p><b>Your access stays yours.</b> Revoke an integration at any time. Provider access is used only for the work you ask Klin to do.</p></div>
          </section>
        )}

        {tab === 'tools' && (
          <section className="built-tools-panel" role="tabpanel" aria-label="Built-in tools">
            <div className="built-tools-intro">
              <div><span className="connector-eyebrow">Live capability status</span><h2>Built-in tools</h2><p>Only tools marked available are enabled in isolated coding sessions.</p></div>
              <span className="tools-ready-badge"><i />{AVAILABLE_TOOL_COUNT} available · {TOOL_COUNT.length - AVAILABLE_TOOL_COUNT} in development</span>
            </div>
            <div className="tool-groups">
              {TOOL_GROUPS.map((group) => (
                <div className="tool-group" key={group.title}>
                  <div className="tool-group-heading"><span><Icon name={group.icon} /></span><h3>{group.title}</h3><small>{group.tools.length} tools</small></div>
                  <div className="tool-list">
                    {group.tools.map((tool) => (
                      <article className="built-tool" key={tool.name}>
                        <span className={`tool-ready-check ${tool.available ? '' : 'tool-not-ready'}`} aria-label={tool.available ? 'Available' : 'In development'}><Icon name={tool.available ? 'check' : 'clock'} /></span>
                        <div><div className="built-tool-title"><b>{tool.name}</b><span className={tool.available ? 'tool-state-live' : 'tool-state-dev'}>{tool.available ? 'Available' : 'In development'}</span></div><p>{tool.detail}</p><code>{tool.commands}</code></div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="tools-footnote"><Icon name="info" /><p>GitHub is the only live OAuth connector today; repository reads are available, while commits, pushes, and pull requests require approval. Browser, database, deployment, and workspace secret tools are not enabled yet. Manage provider access in <button type="button" onClick={() => setParams({ tab: 'integrations' })}>Integrations</button>.</p></div>
          </section>
        )}
      </div>
    </>
  );
}
