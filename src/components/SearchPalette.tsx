import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import Icon from './Icon';
import type { Session } from '@/lib/types';

const PAGES = [
  { label: 'New Chat', detail: 'Start a new task', to: '/', icon: 'edit' },
  { label: 'Sessions', detail: 'Browse all runs', to: '/sessions', icon: 'agent' },
  { label: 'AI Agent', detail: 'Choose a job workflow', to: '/agent', icon: 'skills' },
  { label: 'Scheduled', detail: 'Manage recurring jobs', to: '/scheduled', icon: 'clock' },
  { label: 'Library', detail: 'Artifacts from your runs', to: '/library', icon: 'library' },
  { label: 'Connectors', detail: 'GitHub and integrations', to: '/connections', icon: 'plugins' },
  { label: 'Memory', detail: 'Your saved preferences and rules', to: '/memory', icon: 'layers' },
  { label: 'Settings', detail: 'Models, approvals, and account settings', to: '/settings', icon: 'settings' },
  { label: 'Usage and credits', detail: 'Session cost and usage', to: '/usage', icon: 'chart' },
  { label: 'Audit log', detail: 'External writes and approvals', to: '/audit', icon: 'shield' },
];

export function SearchPalette({ sessions, onClose }: { sessions: Session[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const term = query.trim().toLowerCase();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const pages = useMemo(() => PAGES.filter((page) => !term || `${page.label} ${page.detail}`.toLowerCase().includes(term)), [term]);
  const matchingSessions = useMemo(() => sessions.filter((session) => {
    const haystack = `${session.goal} ${session.repo ?? ''} ${session.branch ?? ''} ${session.status}`.toLowerCase();
    return !term || haystack.includes(term);
  }).slice(0, 8), [sessions, term]);

  function go(path: string) {
    onClose();
    nav(path);
  }

  return (
    <Modal onClose={onClose}>
      <div className="search-palette">
        <div className="search-palette-title"><h2>Search</h2><kbd>Esc</kbd></div>
        <label className="search-box">
          <Icon name="search" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages, sessions, or repositories…" aria-label="Search pages and sessions" />
          <kbd>Ctrl K</kbd>
        </label>
        <div className="search-palette-results">
          {pages.length > 0 && (
            <>
              <div className="search-section-label">Pages</div>
              {pages.slice(0, 6).map((page) => (
                <button type="button" className="search-result" key={page.to} onClick={() => go(page.to)}>
                  <span className="search-result-icon"><Icon name={page.icon} /></span>
                  <span className="search-result-text"><b>{page.label}</b><small>{page.detail}</small></span>
                  <Icon name="chevr" className="search-result-chevron" />
                </button>
              ))}
            </>
          )}
          {matchingSessions.length > 0 && (
            <>
              <div className="search-section-label">{term ? 'Matching sessions' : 'Recent sessions'}</div>
              {matchingSessions.map((session) => (
                <button type="button" className="search-result" key={session.id} onClick={() => go(`/s/${session.id}`)}>
                  <span className="search-result-icon"><Icon name="agent" /></span>
                  <span className="search-result-text"><b>{session.goal}</b><small>{session.repo || 'No repository'} · {session.status}</small></span>
                  <Icon name="chevr" className="search-result-chevron" />
                </button>
              ))}
            </>
          )}
          {!pages.length && !matchingSessions.length && <div className="search-no-results">No pages or sessions match “{query}”.</div>}
        </div>
        <div className="search-palette-footer"><span>Search session goals, repositories, and pages</span><span><kbd>↵</kbd> Open result</span></div>
      </div>
    </Modal>
  );
}
