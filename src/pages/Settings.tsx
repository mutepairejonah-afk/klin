import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { settingsApi, membersApi, secretsApi, type UserSettings } from '@/lib/api';
import type { Member, Secret } from '@/lib/types';

const ALWAYS_ON_RULES = [
  'git push --force', 'rm -rf, DROP, TRUNCATE, DELETE without WHERE', 'ALTER TABLE … DROP', 'Production deploys',
];
const TOGGLEABLE_RULES = ['Using a secret', 'Spending money (Stripe, cloud APIs)', 'Installing system-level packages', 'Running untrusted code (post-install scripts)'];

export default function Settings() {
  const toast = useToast((s) => s.show);
  const [s, setS] = useState<UserSettings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [addSecretOpen, setAddSecretOpen] = useState(false);

  function refreshSecrets() {
    secretsApi.list().then(setSecrets).catch(() => setSecrets([]));
  }

  useEffect(() => {
    settingsApi.get().then(setS).catch(() => setS(null));
    membersApi.list().then(setMembers).catch(() => setMembers([]));
    refreshSecrets();
  }, []);

  function removeSecret(id: string) {
    secretsApi.remove(id)
      .then(() => setSecrets((list) => list.filter((sec) => sec.id !== id)))
      .catch(() => toast('Backend not connected yet'));
  }

  function save(patch: Partial<UserSettings>) {
    settingsApi.update(patch).then(setS).catch(() => toast('Backend not connected yet'));
  }

  return (
    <>
      <HeaderLeft><span className="h-title">Settings</span></HeaderLeft>
      <HeaderRight />
      <div className="wrap narrow">
        <h1 className="h1">Settings</h1>
        <p className="sub">Defaults for every session. You can override them per job.</p>

        <div className="card pad" style={{ marginTop: 22 }}>
          <h3>Profile</h3>
          <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
            <div className="field" style={{ flex: 1 }}><label>Name</label><input className="input w" placeholder="Your name" defaultValue={s?.name} onBlur={(e) => save({ name: e.target.value })} /></div>
            <div className="field" style={{ flex: 1 }}><label>Email</label><input className="input w" placeholder="you@company.com" defaultValue={s?.email} onBlur={(e) => save({ email: e.target.value })} /></div>
          </div>
        </div>

        <div className="card pad" style={{ marginTop: 14 }}>
          <h3>Model routing</h3>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 14 }}>Each agent role runs on its own model.</p>
          {(['planner', 'executor', 'critic', 'retriever'] as const).map((role) => (
            <div className="row-item" style={{ padding: '10px 0' }} key={role}>
              <div className="txt"><b style={{ fontWeight: 500 }}>{role[0].toUpperCase() + role.slice(1)}</b></div>
              <select className="input" defaultValue={s?.modelRouting?.[role]} onChange={(e) => save({ modelRouting: { ...(s?.modelRouting ?? {} as any), [role]: e.target.value } })}>
                <option>Anthropic — large</option><option>Anthropic — fast</option><option>OpenAI — large</option><option>OpenAI — fast</option><option>Self-hosted (vLLM)</option>
              </select>
            </div>
          ))}
        </div>

        <div className="card pad" style={{ marginTop: 14 }}>
          <h3>Coding preferences</h3>
          <div style={{ display: 'flex', gap: 24 }}>
            <div className="field" style={{ flex: 1 }}><label>Test framework</label>
              <select className="input" defaultValue={s?.testFramework} onChange={(e) => save({ testFramework: e.target.value })}><option>Vitest</option><option>Jest</option><option>Pytest</option></select></div>
            <div className="field" style={{ flex: 1 }}><label>Commit style</label>
              <select className="input" defaultValue={s?.commitStyle} onChange={(e) => save({ commitStyle: e.target.value })}><option>Conventional commits</option><option>Plain sentences</option></select></div>
          </div>
          <div className="field"><label>Branch naming</label><input className="input w mono" placeholder="feature/{slug}" defaultValue={s?.branchNaming} onBlur={(e) => save({ branchNaming: e.target.value })} /></div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ padding: '18px 20px 6px' }}><h3>Ask me before the agent…</h3><p className="muted" style={{ margin: 0, fontSize: 14 }}>Destructive actions always need approval and can’t be turned off.</p></div>
          {ALWAYS_ON_RULES.map((r) => (
            <div className="row-item" key={r}><div className="txt">{r}</div><span className="badge">Always</span><label className="switch"><input type="checkbox" checked disabled aria-label={r} /><span /></label></div>
          ))}
          {TOGGLEABLE_RULES.map((r) => (
            <div className="row-item" key={r}><div className="txt">{r}</div>
              <label className="switch">
                <input type="checkbox" checked={s?.approvalRules?.[r] ?? true}
                  onChange={(e) => save({ approvalRules: { ...(s?.approvalRules ?? {}), [r]: e.target.checked } })} aria-label={r} />
                <span />
              </label>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ padding: '18px 20px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Members</h3>
            <button className="btn sm" onClick={() => { const email = prompt('Invite by email'); if (email) membersApi.invite(email, 'operator').then((m) => setMembers((ms) => [...ms, m])).catch(() => toast('Backend not connected yet')); }}>
              <Icon name="plus" />Invite
            </button>
          </div>
          {members.length === 0
            ? <div className="muted" style={{ padding: '14px 20px' }}>No members yet.</div>
            : members.map((m) => (
              <div className="row-item" key={m.id}>
                <span className="avatar" style={{ width: 32, height: 32 }}>{m.name[0]}</span>
                <div className="txt"><b style={{ fontWeight: 500 }}>{m.name}</b><small>{m.email}</small></div>
                <select className="input" disabled={m.role === 'owner'} defaultValue={m.role}
                  onChange={(e) => membersApi.updateRole(m.id, e.target.value as Member['role']).catch(() => toast('Backend not connected yet'))}>
                  <option value="owner">Owner</option><option value="operator">Operator</option><option value="viewer">Viewer</option>
                </select>
              </div>
            ))}
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ padding: '18px 20px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Secrets</h3>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: 14 }}>Handle-only — values are encrypted and never shown again.</p>
            </div>
            <button className="btn sm" onClick={() => setAddSecretOpen(true)}><Icon name="plus" />Add secret</button>
          </div>
          {secrets.length === 0
            ? <div className="muted" style={{ padding: '14px 20px' }}>No secrets yet. The agent refers to a secret by its handle — the value is injected at command time and never enters the model's context.</div>
            : secrets.map((sec) => (
              <div className="row-item" key={sec.id}>
                <Icon name="lock" />
                <div className="txt"><b className="mono" style={{ fontWeight: 500 }}>{sec.handle}</b><small>Scope: {sec.scope}{sec.lastUsedAt ? ` · last used ${new Date(sec.lastUsedAt).toLocaleDateString()}` : ''}</small></div>
                <button className="icon-btn" aria-label={`Remove ${sec.handle}`} onClick={() => removeSecret(sec.id)}><Icon name="trash" /></button>
              </div>
            ))}
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <Link className="row-item" to="/usage"><Icon name="chart" /><div className="txt"><b style={{ fontWeight: 500 }}>Usage and credits</b><small>Cost per session and your success targets</small></div><Icon name="chevr" /></Link>
          <Link className="row-item" to="/audit"><Icon name="shield" /><div className="txt"><b style={{ fontWeight: 500 }}>Audit log</b><small>Every external write and approval</small></div><Icon name="chevr" /></Link>
        </div>
      </div>

      {addSecretOpen && (
        <Modal onClose={() => setAddSecretOpen(false)}>
          <AddSecretForm onDone={() => { setAddSecretOpen(false); refreshSecrets(); }} onClose={() => setAddSecretOpen(false)} />
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
      <p className="s">The agent refers to it by handle. The value is injected into the sandbox when a command runs and never enters the model's context.</p>
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
