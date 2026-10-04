import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { Modal } from '@/components/Modal';
import { useSessions } from '@/hooks/useSessions';
import { memoryApi } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { RowItemsSkeleton, Skeleton } from '@/components/Skeleton';

type OrgMemoryEntry = Awaited<ReturnType<typeof memoryApi.addOrgMemory>>;

export default function Memory() {
  const { sessions } = useSessions();
  const toast = useToast((s) => s.show);
  const [repoIndex, setRepoIndex] = useState<Awaited<ReturnType<typeof memoryApi.repoIndex>>>([]);
  const [userMem, setUserMem] = useState<Record<string, string>>({});
  const [newPreference, setNewPreference] = useState('');
  const [orgMem, setOrgMem] = useState<OrgMemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSaving, setUserSaving] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      memoryApi.repoIndex().then(setRepoIndex).catch(() => setRepoIndex([])),
      memoryApi.userMemory().then(setUserMem).catch(() => setUserMem({})),
      memoryApi.orgMemory().then(setOrgMem).catch(() => setOrgMem([])),
    ]).finally(() => setLoading(false));
  }, []);

  async function saveUserMemory() {
    if (userSaving) return;
    setUserSaving(true);
    try {
      const updates = { ...userMem };
      if (newPreference.trim()) {
        let key = 'preference';
        let suffix = 2;
        while (Object.prototype.hasOwnProperty.call(updates, key)) key = `preference_${suffix++}`;
        updates[key] = newPreference.trim();
      }
      setUserMem(await memoryApi.updateUserMemory(updates));
      setNewPreference('');
      toast('Your preferences are saved.');
    } catch {
      toast('Could not save preferences. Check your connection or permissions.');
    } finally {
      setUserSaving(false);
    }
  }

  function addOrgRule(rule: OrgMemoryEntry) {
    setOrgMem((entries) => [rule, ...entries]);
    setRuleOpen(false);
  }

  return (
    <>
      <HeaderLeft><span className="h-title">Memory</span></HeaderLeft>
      <HeaderRight />
      <div className="wrap">
        <div className="pg-h"><div><h1 className="h1">Memory</h1><p className="sub">What the agent carries between steps, sessions and repos.</p></div></div>
        <div className="grid g2" style={{ marginTop: 22 }}>
          <div className="card pad">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <span className="ico-sq"><Icon name="list" /></span>
              <div style={{ flex: 1 }}><h3 style={{ margin: 0 }}>Session memory</h3><div className="muted" style={{ fontSize: 13.5 }}>Event log, decisions and artifacts for each session.</div></div>
              <Link className="btn sm" to="/sessions">Browse</Link>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div>{loading ? <Skeleton width={40} height={24} /> : <div className="mono" style={{ fontSize: 24 }}>{sessions.length}</div>}<div className="muted" style={{ fontSize: 13 }}>sessions</div></div>
            </div>
          </div>

          <div className="card pad">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <span className="ico-sq"><Icon name="folder" /></span>
              <div style={{ flex: 1 }}><h3 style={{ margin: 0 }}>Repo memory</h3><div className="muted" style={{ fontSize: 13.5 }}>Indexed code (embeddings + symbol graph).</div></div>
            </div>
            {loading && <RowItemsSkeleton rows={2} />}
            {!loading && (repoIndex.length === 0
              ? <div className="muted" style={{ fontSize: 14 }}>Repository indexing is not configured on this server yet. Connecting GitHub alone will not start an index.</div>
              : repoIndex.map((r) => (
                <div className="row-item" style={{ padding: '10px 0' }} key={r.repo}>
                  <div className="txt"><b className="mono" style={{ fontWeight: 500, fontSize: 13.5 }}>{r.repo}</b><small>{r.files} files · {r.symbols} symbols · indexed {r.indexedAt}</small></div>
                  <span className={`badge ${r.stale ? 'warn' : 'ok'}`}>{r.stale ? 'Stale' : 'Ready'}</span>
                </div>
              )))}
          </div>

          <div className="card pad">
            <div className="memory-card-heading">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="ico-sq"><Icon name="user" /></span>
                <div><h3 style={{ margin: 0 }}>User memory</h3><div className="muted" style={{ fontSize: 13.5 }}>Your habits, applied to every job.</div></div>
              </div>
              <button type="button" className="btn sm" disabled={loading || userSaving} onClick={() => void saveUserMemory()}>
                {userSaving ? <span className="spin" /> : <Icon name="check" />}{userSaving ? 'Saving' : 'Save preferences'}
              </button>
            </div>
            {loading && <RowItemsSkeleton rows={2} />}
            {!loading && (Object.keys(userMem).length === 0
              ? <div className="muted" style={{ fontSize: 14 }}>Nothing saved yet. Add a preference below.</div>
              : Object.entries(userMem).map(([key, value]) => (
                <label className="memory-pref-row" key={key}>
                  <span>{key}</span>
                  <input className="input w" value={value} aria-label={key} onChange={(event) => setUserMem((current) => ({ ...current, [key]: event.target.value }))} />
                </label>
              )))}
            <label className="field memory-new-pref"><span className="field-label">Add a preference</span><input className="input w" placeholder="e.g. Prefer small, focused pull requests" value={newPreference} onChange={(event) => setNewPreference(event.target.value)} /></label>
          </div>

          <div className="card pad">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <span className="ico-sq"><Icon name="users" /></span>
              <div style={{ flex: 1 }}><h3 style={{ margin: 0 }}>Org memory</h3><div className="muted" style={{ fontSize: 13.5 }}>Conventions, runbooks and lessons.</div></div>
              <button type="button" className="btn sm" onClick={() => setRuleOpen(true)}><Icon name="plus" />Add rule</button>
            </div>
            {loading && <RowItemsSkeleton rows={2} />}
            {!loading && (orgMem.length === 0
              ? <div className="muted" style={{ fontSize: 14 }}>No shared rules yet.</div>
              : orgMem.map((rule) => (
                <div className="row-item" style={{ padding: '10px 0' }} key={rule.id}><div className="txt">{rule.text}</div><span className="badge">{rule.kind}</span></div>
              )))}
          </div>
        </div>
      </div>

      {ruleOpen && <Modal onClose={() => setRuleOpen(false)}><AddOrgRuleForm onDone={addOrgRule} onClose={() => setRuleOpen(false)} /></Modal>}
    </>
  );
}

function AddOrgRuleForm({ onDone, onClose }: { onDone: (rule: OrgMemoryEntry) => void; onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const [text, setText] = useState('');
  const [kind, setKind] = useState('convention');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      onDone(await memoryApi.addOrgMemory(trimmed, kind));
      toast('Organization rule added.');
    } catch {
      toast('Could not add the rule. You may need operator access.');
      setSaving(false);
    }
  }

  return (
    <>
      <h2>Add an organization rule</h2>
      <p className="s">The agent will use this shared guidance in future work for your organization.</p>
      <div className="field"><label htmlFor="org-memory-kind">Category</label><select id="org-memory-kind" className="input" value={kind} onChange={(event) => setKind(event.target.value)}><option value="convention">Convention</option><option value="runbook">Runbook</option><option value="lesson">Lesson</option></select></div>
      <div className="field"><label htmlFor="org-memory-text">Rule</label><textarea id="org-memory-text" className="input w memory-rule-text" maxLength={2000} placeholder="Describe a convention or instruction the agent should remember…" value={text} onChange={(event) => setText(event.target.value)} /></div>
      <div className="foot"><button type="button" className="btn" disabled={saving} onClick={onClose}>Cancel</button><button type="button" className="btn pri" disabled={saving || !text.trim()} onClick={() => void submit()}>{saving ? <span className="spin" /> : <Icon name="plus" />}{saving ? 'Adding…' : 'Add rule'}</button></div>
    </>
  );
}
