import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { BRAND } from '@/lib/brand';
import { useUiStore } from '@/lib/store';
import { useSessions } from '@/hooks/useSessions';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from './Toast';
import { authApi } from '@/lib/api';

const NAV_WORK = [
  { to: '/', label: 'New task', icon: 'edit', end: true },
  { to: '/sessions', label: 'Sessions', icon: 'agent' },
  { to: '/jobs', label: 'Jobs', icon: 'skills' },
  { to: '/scheduled', label: 'Scheduled', icon: 'clock' },
  { to: '/library', label: 'Library', icon: 'library' },
];
const NAV_SETUP = [
  { to: '/connections', label: 'Connections', icon: 'plugins' },
  { to: '/memory', label: 'Memory', icon: 'layers' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

export default function Sidebar() {
  const { mobileSidebarOpen, setMobileSidebarOpen, toggleSidebar } = useUiStore();
  const { sessions } = useSessions();
  const { user } = useAuth();
  const waiting = sessions.filter((s) => s.status === 'waiting_approval').length;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const toast = useToast((s) => s.show);
  const { id: activeSessionId } = useParams();

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  return (
    <>
      <div className="scrim" onClick={() => setMobileSidebarOpen(false)} />
      <aside className="sidebar" aria-label="Sidebar">
        <div className="sb-top">
          <NavLink to="/" className="brand">
            <svg viewBox="0 0 32 32" aria-hidden><rect x="3.5" y="3.5" width="25" height="25" rx="8" fill="none" stroke="currentColor" strokeWidth={1.6} />
              <path d="m11 12.5 5 3.5-5 3.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="20.5" cy="20.5" r="1.9" fill="currentColor" /></svg>
            <span>{BRAND.name}<span style={{ color: 'var(--blue)' }}>.</span></span>
          </NavLink>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="icon-btn" aria-label="Search" onClick={() => toast('Search — ⌘K')}><Icon name="search" /></button>
            <button className="icon-btn" aria-label="Collapse sidebar" onClick={toggleSidebar}><Icon name="panel" /></button>
          </div>
        </div>

        <div className="sb-scroll">
          <nav className="nav">
            <div className="grp">Work</div>
            {NAV_WORK.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
                <Icon name={n.icon} />{n.label}
                {n.to === '/sessions' && waiting > 0 && <span className="dot">{waiting}</span>}
              </NavLink>
            ))}
            <div className="grp">Setup</div>
            {NAV_SETUP.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'on' : '')}>
                <Icon name={n.icon} />{n.label}
              </NavLink>
            ))}
          </nav>

          <div className="sec"><span>Sessions</span><NavLink to="/sessions" className="icon-btn" aria-label="All sessions"><Icon name="filter" /></NavLink></div>
          <div className="list">
            {sessions.length === 0 && <div className="muted" style={{ padding: '6px 10px', fontSize: 14 }}>No tasks yet</div>}
            {sessions.slice(0, 6).map((s) => (
              <NavLink key={s.id} to={`/s/${s.id}`} className={activeSessionId === s.id ? 'on' : ''}>
                <span className="task-ic"><Icon name="agent" /></span>
                <span className="t">{s.goal}</span>
              </NavLink>
            ))}
          </div>
        </div>

        <div className="sb-bottom" ref={menuRef}>
          <button className="user-btn" onClick={() => setMenuOpen((v) => !v)}>
            <span className="avatar">{(user?.name || 'A')[0].toUpperCase()}</span>
            <span>{user?.name || 'Account'}</span>
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="icon-btn" aria-label="Get the desktop app" onClick={() => toast('Desktop app — coming soon')}><Icon name="devices" /></button>
            <button className="icon-btn" aria-label="Notifications" onClick={() => nav('/sessions?status=waiting_approval')}><Icon name="bell" /></button>
          </div>
          {menuOpen && (
            <div className="menu" style={{ left: 10, bottom: 60, top: 'auto', width: 250 }}>
              <div style={{ padding: '8px 10px 6px' }}>
                <b>{user?.name || 'Account'}</b>
                <small style={{ display: 'block', color: 'var(--text-3)' }}>{user?.email || ''}</small>
              </div>
              <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '6px 4px' }} />
              <NavLink to="/settings" onClick={() => setMenuOpen(false)}><Icon name="settings" />Settings</NavLink>
              <NavLink to="/usage" onClick={() => setMenuOpen(false)}><Icon name="chart" />Usage and credits</NavLink>
              <NavLink to="/audit" onClick={() => setMenuOpen(false)}><Icon name="shield" />Audit log</NavLink>
              <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '6px 4px' }} />
              <button onClick={() => { authApi.signOut().finally(() => nav('/signin')); }}><Icon name="logout" />Sign out</button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
