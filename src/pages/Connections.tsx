import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { CONNECTOR_CATALOG } from '@/lib/connectorCatalog';
import { connectionsApi, secretsApi } from '@/lib/api';
import type { Connector, Secret } from '@/lib/types';

const TABS = [
  { key: 'integrations', label: 'Integrations' },
  { key: 'secrets', label: 'Secrets' },
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
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  function refresh() {
    connectionsApi.list().then(setConnectors).catch(() => setConnectors([]));
    secretsApi.list().then(setSecrets).catch(() => setSecrets([]));
  }
  useEffect(refresh, []);

  const byId = new Map(connectors.map((c) => [c.id, c]));

  return (
    <>
      <HeaderLeft><span className="h-title">Connections</span></HeaderLeft>
      <HeaderRight>{tab === 'secrets' && <button className="btn pri" onClick={() => setAddOpen(true)}><Icon name="plus" />Add secret</button>}</HeaderRight>
      <div className="wrap">
        <div className="pg-h"><div><h1 className="h1">Connections</h1><p className="sub">Accounts, secrets and tools the agent can use.</p></div></div>
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

        {tab === 'secrets' && (
          <>
            <div className="card pad" style={{ marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Icon name="lock" />
              <div><b style={{ fontWeight: 500 }}>The agent never sees secret values.</b>
                <div className="muted" style={{ fontSize: 14 }}>It refers to a secret by its handle. The value is injected when a command runs and is redacted from logs and shared replays.</div></div>
            </div>
            {secrets.length === 0
              ? <div className="card empty"><div className="ico-sq"><Icon name="lock" /></div><b>No secrets yet</b>Add one and the agent can use it by its handle.</div>
              : (
                <div className="table-wrap"><table>
                  <thead><tr><th>Handle</th><th>Scope</th><th>Value</th><th>Created</th><th>Last used</th><th /></tr></thead>
                  <tbody>{secrets.map((s) => (
                    <tr key={s.id}>
                      <td className="mono" style={{ fontSize: 13 }}>{s.handle}</td><td>{s.scope}</td>
                      <td className="muted mono">••••••••••••</td><td>{s.createdAt}</td><td className="muted">{s.lastUsedAt || 'Never'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="icon-btn" aria-label={`Delete ${s.handle}`} onClick={() => secretsApi.remove(s.id).then(refresh).catch(() => toast('Backend not connected yet'))}>
                          <Icon name="trash" />
                        </button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
          </>
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

      {addOpen && (
        <Modal onClose={() => setAddOpen(false)}>
          <AddSecretForm onDone={() => { setAddOpen(false); refresh(); }} onClose={() => setAddOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function AddSecretForm({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const [handle, setHandle] = useState('');
  const [value, setValue] = useState('');
  const [scope, setScope] = useState('All repos');
  return (
    <>
      <h2>Add a secret</h2>
      <p className="s">The agent refers to it by handle. The value is injected into the sandbox when a command runs and never enters the model’s context.</p>
      <div className="field"><label>Handle</label><input className="input w mono" placeholder="SECRET_HANDLE" value={handle} onChange={(e) => setHandle(e.target.value.toUpperCase().replace(/\s+/g, '_'))} /></div>
      <div className="field"><label>Value</label><input className="input w" type="password" placeholder="Paste the value" value={value} onChange={(e) => setValue(e.target.value)} /></div>
      <div className="field"><label>Scope</label><select className="input" value={scope} onChange={(e) => setScope(e.target.value)}><option>All repos</option></select></div>
      <div className="foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn pri" onClick={() => {
          if (!handle) { toast('Enter a handle'); return; }
          secretsApi.create(handle, value, scope).then(onDone).catch(() => toast('Backend not connected yet'));
        }}>Save secret</button>
      </div>
    </>
  );
}
