import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import Icon from './Icon';
import { useUiStore } from '@/lib/store';
import { useToast } from './Toast';

export default function Shell() {
  const { sidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen } = useUiStore();
  const location = useLocation();
  const toast = useToast((s) => s.show);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMobileSidebarOpen(false); }, [location.pathname]);

  return (
    <div className={`app ${sidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'open' : ''}`}>
      <Sidebar />
      <main className="main">
        <header className="header">
          <div className="h-left" id="header-left">
            <button
              className="icon-btn open-sb"
              aria-label="Open sidebar"
              onClick={() => (window.matchMedia('(max-width:860px)').matches
                ? setMobileSidebarOpen(true)
                : useUiStore.getState().toggleSidebar())}
            >
              <Icon name="panel" />
            </button>
          </div>
          <div className="h-right" id="header-right">
            <button className="btn" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', border: 'none' }} onClick={() => toast('Plans and credits appear here once billing is connected')}>
              <Icon name="spark" /> Upgrade
            </button>
          </div>
        </header>
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
