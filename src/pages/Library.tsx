import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { artifactsApi } from '@/lib/api';
import type { Artifact, ArtifactKind } from '@/lib/types';

const KINDS: { key: ArtifactKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'pr', label: 'Pull requests' }, { key: 'diff', label: 'Diffs' },
  { key: 'schema', label: 'Schemas' }, { key: 'file', label: 'Files' }, { key: 'screenshot', label: 'Screenshots' },
  { key: 'preview', label: 'Previews' }, { key: 'test', label: 'Test reports' },
];
const ICON: Record<ArtifactKind, string> = { pr: 'branch', preview: 'globe', test: 'flask', schema: 'db', diff: 'code', file: 'doc', screenshot: 'image' };

export default function Library() {
  const [params, setParams] = useSearchParams();
  const kind = (params.get('k') as ArtifactKind | 'all') || 'all';
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  useEffect(() => { artifactsApi.list(kind === 'all' ? undefined : kind).then(setArtifacts).catch(() => setArtifacts([])); }, [kind]);

  return (
    <>
      <HeaderLeft><span className="h-title">Library</span></HeaderLeft>
      <HeaderRight />
      <div className="wrap">
        <div className="pg-h"><div><h1 className="h1">Library</h1><p className="sub">Everything the agent has produced: PRs, diffs, schemas, files, screenshots, previews and reports.</p></div></div>
        <div className="tabs">{KINDS.map((k) => <button key={k.key} className={`tab ${kind === k.key ? 'on' : ''}`} onClick={() => setParams(k.key === 'all' ? {} : { k: k.key })}>{k.label}</button>)}</div>
        {artifacts.length === 0
          ? <div className="card empty"><div className="ico-sq"><Icon name="library" /></div><b>Nothing here yet</b>Artifacts of this type will appear after the agent creates one.</div>
          : (
            <div className="grid g3">
              {artifacts.map((a) => (
                <div className="card pad" key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className="ico-sq" style={{ width: 32, height: 32 }}><Icon name={ICON[a.kind]} /></span>
                    <span style={{ minWidth: 0 }}><b style={{ fontWeight: 500, display: 'block' }}>{a.title}</b><span className="muted" style={{ fontSize: 13 }}>{a.sessionId}</span></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <span className="muted" style={{ fontSize: 13 }}>{a.meta}</span>
                    <Link className="btn sm" to={`/s/${a.sessionId}`}>Open session</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </>
  );
}
