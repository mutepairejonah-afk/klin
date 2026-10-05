import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { useToast } from '@/components/Toast';
import { CONNECTOR_CATALOG } from '@/lib/connectorCatalog';
import { ApiError, connectionsApi } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import type { Connector } from '@/lib/types';

const TABS = [
  { key: 'integrations', label: 'Integrations' },
  { key: 'tools', label: 'Tools (MCP)' },
];

const MCP_TOOLS = [
  { name: 'filesystem', icon: 'folder', tools: 'read_file · write_file · list_dir · apply_patch · search' },
  { name: 'shell', icon: 'terminal', tools: 'exec (timeout + cwd)' },
  { name: 'git', icon: 'branch', tools: 'clone · status · diff · branch · commit · push · pr_create' },
  { name: 'browser', icon: 'globe', tools: 'navigate · click · type · screenshot · extract' },
  { name: 'database', icon: 'db', tools: 'get_schema · generate_sql · dry_run · execute · rollback' },
  { name: 'tests', icon: 'flask', tools: 'run_tests · parse_results' },
  { name: 'deploy', icon: 'rocket', tools: 'preview_deploy · logs · rollback_deploy' },
  { name: 'secrets', icon: 'lock', tools: 'request_secret (handle only)' },
];

export default function Connections() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'integrations';
  const toast = useToast((s) => s.show);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  function explainError(error: unknown, fallback: string) {
    if (error instanceof ApiError && error.status === 429) return `Too many requests. Try again in ${error.retryAfter ?? 15} seconds.`;
    if (error instanceof ApiError && error.status === 401) return 'Your Clerk session expired. Sign in again.';
    if (error instanceof ApiError && error.status === 403) return 'Only an organization operator can change connectors.';
    if (error instanceof ApiError && error.message) return error.message;
    return fallback;
  }

  function refresh() {
    setLoading(true);
    connectionsApi.list().then((items) => { setConnectors(items); setLoadError(null); }).catch((error) => { setConnectors([]); setLoadError(explainError(error, 'Could not load connectors.')); }).finally(() => setLoading(false));
  }
  useEffect(refresh, []);

  // After a real OAuth round-trip, GitHub's callback redirects back here with
  // ?connected=github or ?error=... — surface it once, then clean the URL.
  useEffect(() => {
    const connected = params.get('connected');
    const err = params.get('error');
    if (connected) { toast(`Connected ${connected}`); refresh(); }
    if (err) toast(err === 'github_not_configured' ? 'GitHub OAuth is not configured on the server.' : `Connection failed: ${err.split('_').join(' ')}`);
    if (connected || err) { params.delete('connected'); params.delete('error'); setParams(params, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = new Map(connectors.map((c) => [c.id, c]));

  return (
    <>
      <HeaderLeft><span className="h-title">Connectors</span></HeaderLeft>
      <HeaderRight />
      <div className="wrap">
        <div className="pg-h"><div><h1 className="h1">Connectors</h1><p className="sub">Accounts and tools the agent can use.</p></div></div>
        <div className="tabs">
          {TABS.map((t) => <button key={t.key} className={`tab ${tab === t.key ? 'on' : ''}`} onClick={() => setParams({ tab: t.key })}>{t.label}</button>)}
        </div>

        {tab === 'integrations' && (
          <div className="grid g2">
            {loadError && <div className="card pad" style={{ gridColumn: '1 / -1' }}><div className="muted">{loadError}</div><button className="btn sm" onClick={refresh} style={{ marginTop: 10 }}>Retry</button></div>}
            {CONNECTOR_CATALOG.map((c) => {
              const live = byId.get(c.id);
              const connected = !!live?.connected;
              return (
                <div className="card pad" key={c.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <span className="logo">{c.id === 'github' ? <Icon name="gh" /> : c.name[0]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ fontWeight: 600 }}>{c.name}</b>
                      {connected && <span className="badge ok">Connected</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 14, margin: '2px 0 8px' }}>{c.description}</div>
                    {connected && (
                      <>
                        <div className="muted" style={{ fontSize: 13 }}>
                          {typeof live?.meta === 'string' ? live.meta : live?.meta?.login ? `Signed in as ${live.meta.login}` : null}
                        </div>
                        <div className="chips" style={{ marginTop: 8 }}>{c.scopes.map((s) => <span className="badge" key={s}>{s}</span>)}</div>
                      </>
                    )}
                    {!connected && live && !live.oauth && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <input
                          className="input"
                          style={{ flex: 1, minWidth: 0 }}
                          type="password"
                          autoComplete="off"
                          placeholder={`Paste ${c.name} token`}
                          value={tokens[c.id] ?? ''}
                          onChange={(e) => setTokens((current) => ({ ...current, [c.id]: e.target.value }))}
                          aria-label={`${c.name} token`}
                        />
                        <button className="btn sm pri" disabled={connecting === c.id || !tokens[c.id]?.trim()} onClick={() => {
                          setConnecting(c.id);
                          connectionsApi.connect(c.id, tokens[c.id].trim()).then(() => {
                            setTokens((current) => ({ ...current, [c.id]: '' }));
                            toast(`Connected ${c.name}`);
                            refresh();
                          }).catch((error) => toast(explainError(error, `${c.name} credential validation failed.`))).finally(() => setConnecting(null));
                        }}>{connecting === c.id ? 'Checking…' : 'Verify'}</button>
                      </div>
                    )}
                  </div>
                  {(connected || !live || live.oauth) && <button
                    className={`btn sm ${connected ? '' : 'pri'}`}
                    disabled={loading}
                    onClick={() => {
                      if (connected) { connectionsApi.disconnect(c.id).then(refresh).catch((error) => toast(explainError(error, 'Could not disconnect this connector.'))); return; }
                      if (live?.oauth) {
                        connectionsApi.githubOAuthUrl()
                          .then(({ url }) => { window.location.href = url; })
                          .catch((error) => toast(explainError(error, 'GitHub OAuth is not configured on the server.')));
                        return;
                      }
                      connectionsApi.connect(c.id, '').then(refresh).catch((error) => toast(explainError(error, 'Enter a provider token first.')));
                    }}
                  >
                    {loading ? <Skeleton width={50} height={12} style={{ display: 'inline-block' }} /> : connected ? 'Manage' : 'Connect'}
                  </button>}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'tools' && (
          <div className="card">
            {MCP_TOOLS.map((t) => (
              <div className="row-item" key={t.name}>
                <span className="ico-sq"><Icon name={t.icon} /></span>
                <div className="txt"><b style={{ fontWeight: 500 }}>{t.name}</b><small className="mono" style={{ fontSize: 12.5 }}>{t.tools}</small></div>
                <label className="switch"><input type="checkbox" defaultChecked aria-label={`Enable ${t.name}`} /><span /></label>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
