import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { useSessions } from '@/hooks/useSessions';
import { memoryApi } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function Memory() {
  const { sessions } = useSessions();
  const toast = useToast((s) => s.show);
  const [repoIndex, setRepoIndex] = useState<Awaited<ReturnType<typeof memoryApi.repoIndex>>>([]);
  const [userMem, setUserMem] = useState<Record<string, string>>({});
  const [orgMem, setOrgMem] = useState<Awaited<ReturnType<typeof memoryApi.orgMemory>>>([]);

  useEffect(() => {
    memoryApi.repoIndex().then(setRepoIndex).catch(() => setRepoIndex([]));
    memoryApi.userMemory().then(setUserMem).catch(() => setUserMem({}));
    memoryApi.orgMemory().then(setOrgMem).catch(() => setOrgMem([]));
  }, []);

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
              <div><div className="mono" style={{ fontSize: 24 }}>{sessions.length}</div><div className="muted" style={{ fontSize: 13 }}>sessions</div></div>
            </div>
          </div>

          <div className="card pad">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <span className="ico-sq"><Icon name="folder" /></span>
              <div style={{ flex: 1 }}><h3 style={{ margin: 0 }}>Repo memory</h3><div className="muted" style={{ fontSize: 13.5 }}>Indexed code (embeddings + symbol graph).</div></div>
            </div>
            {repoIndex.length === 0
              ? <div className="muted" style={{ fontSize: 14 }}>No repositories indexed yet. Connect GitHub to start.</div>
              : repoIndex.map((r) => (
                <div className="row-item" style={{ padding: '10px 0' }} key={r.repo}>
                  <div className="txt"><b className="mono" style={{ fontWeight: 500, fontSize: 13.5 }}>{r.repo}</b><small>{r.files} files · {r.symbols} symbols · indexed {r.indexedAt}</small></div>
                  <span className={`badge ${r.stale ? 'warn' : 'ok'}`}>{r.stale ? 'Stale' : 'Ready'}</span>
                </div>
              ))}
          </div>

          <div className="card pad">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <span className="ico-sq"><Icon name="user" /></span>
              <div style={{ flex: 1 }}><h3 style={{ margin: 0 }}>User memory</h3><div className="muted" style={{ fontSize: 13.5 }}>Your habits, applied to every job.</div></div>
            </div>
            {Object.keys(userMem).length === 0
              ? <div className="muted" style={{ fontSize: 14 }}>Nothing saved yet. Preferences are added as you work.</div>
              : Object.entries(userMem).map(([k, v]) => (
                <div className="row-item" style={{ padding: '9px 0' }} key={k}><div className="txt" style={{ flex: '0 0 130px' }}>{k}</div><input className="input w" defaultValue={v} aria-label={k} /></div>
              ))}
          </div>

          <div className="card pad">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <span className="ico-sq"><Icon name="users" /></span>
              <div style={{ flex: 1 }}><h3 style={{ margin: 0 }}>Org memory</h3><div className="muted" style={{ fontSize: 13.5 }}>Conventions, runbooks and lessons.</div></div>
              <button className="btn sm" onClick={() => toast('Add an org rule')}><Icon name="plus" />Add</button>
            </div>
            {orgMem.length === 0
              ? <div className="muted" style={{ fontSize: 14 }}>No shared rules yet.</div>
              : orgMem.map((r) => (
                <div className="row-item" style={{ padding: '10px 0' }} key={r.id}><div className="txt">{r.text}</div><span className="badge">{r.kind}</span></div>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}
