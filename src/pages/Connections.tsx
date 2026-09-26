import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { useToast } from '@/components/Toast';
import { CONNECTOR_CATALOG } from '@/lib/connectorCatalog';
import { connectionsApi } from '@/lib/api';
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

  function refresh() {
    connectionsApi.list().then(setConnectors).catch(() => setConnectors([]));
  }
  useEffect(refresh, []);

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
                        <div className="muted" style={{ fontSize: 13 }}>{live?.meta}</div>
                        <div className="chips" style={{ marginTop: 8 }}>{c.scopes.map((s) => <span className="badge" key={s}>{s}</span>)}</div>
                      </>
                    )}
                  </div>
                  <button
                    className={`btn sm ${connected ? '' : 'pri'}`}
                    onClick={() => (connected
                      ? connectionsApi.disconnect(c.id).then(refresh).catch(() => toast('Backend not connected yet'))
                      : connectionsApi.connect(c.id).then(refresh).catch(() => toast('Backend not connected yet')))}
                  >
                    {connected ? 'Manage' : 'Connect'}
                  </button>
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
