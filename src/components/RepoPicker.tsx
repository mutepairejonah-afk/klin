import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { connectionsApi } from '@/lib/api';

interface Repo { fullName: string; private: boolean; defaultBranch: string }

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, close]);
  return ref;
}

// Repo pill: lists real repos from the connected GitHub account (not free
// text). If GitHub isn't connected, links to Connectors instead of opening.
export function RepoPicker({ repo, connected, onPick }: { repo: string; connected: boolean; onPick: (repo: string, defaultBranch: string) => void }) {
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [reload, setReload] = useState(0);
  const ref = useOutsideClose(open, () => setOpen(false));

  useEffect(() => {
    if (!open || repos || !connected) return;
    setErr('');
    connectionsApi.githubRepos().then((items) => { setRepos(items); setErr(''); }).catch(() => setErr('Could not load repos — check the GitHub connection'));
  }, [open, connected, repos, reload]);

  if (!connected) {
    return (
      <Link to="/connections" className="pill">
        <Icon name="folder" />Connect GitHub to pick a repo
      </Link>
    );
  }

  const filtered = (repos ?? []).filter((r) => r.fullName.toLowerCase().includes(q.toLowerCase())).slice(0, 30);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="pill" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}><Icon name="folder" />{repo || 'Repository'}</button>
      {open && (
        <div className="menu repo-menu" role="menu">
          <input autoFocus placeholder="Search repos…" value={q} onChange={(e) => setQ(e.target.value)} />
          {err && <div className="repo-error"><span>{err}</span><button type="button" onClick={() => { setRepos(null); setErr(''); setReload((n) => n + 1); }}><Icon name="retry" />Retry</button></div>}
          {!repos && !err && <div className="mh">Loading…</div>}
          {repos && filtered.length === 0 && <div className="mh">No matching repos</div>}
          {filtered.map((r) => (
            <button key={r.fullName} role="menuitem" onClick={() => { onPick(r.fullName, r.defaultBranch); setOpen(false); }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name={r.private ? 'lock' : 'folder'} />{r.fullName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Branch pill: lists real branches for the currently selected repo.
export function BranchPicker({ repo, branch, onPick }: { repo: string; branch: string; onPick: (branch: string) => void }) {
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<string[] | null>(null);
  const [err, setErr] = useState('');
  const [reload, setReload] = useState(0);
  const ref = useOutsideClose(open, () => setOpen(false));

  useEffect(() => {
    if (!open || !repo) return;
    setBranches(null); setErr('');
    connectionsApi.githubBranches(repo).then((items) => { setBranches(items); setErr(''); }).catch(() => setErr('Could not load branches'));
  }, [open, repo, reload]);

  if (!repo) return <span className="pill" style={{ opacity: 0.5 }}><Icon name="branch" />Pick a repo first</span>;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="pill" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}><Icon name="branch" />{branch || 'Branch'}</button>
      {open && (
        <div className="menu repo-menu" role="menu">
          {err && <div className="repo-error"><span>{err}</span><button type="button" onClick={() => { setBranches(null); setErr(''); setReload((n) => n + 1); }}><Icon name="retry" />Retry</button></div>}
          {!branches && !err && <div className="mh">Loading…</div>}
          {branches?.map((b) => (
            <button key={b} role="menuitem" onClick={() => { onPick(b); setOpen(false); }}>{b}</button>
          ))}
        </div>
      )}
    </div>
  );
}
