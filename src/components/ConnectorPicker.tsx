import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { CONNECTOR_CATALOG } from '@/lib/connectorCatalog';
import { useUiStore } from '@/lib/store';
import type { Connector } from '@/lib/types';

function ConnLogo({ id, name }: { id: string; name: string }) {
  return (
    <span className={`cl cl-${id}`} aria-hidden="true">
      {id === 'github' ? <Icon name="gh" /> : id === 'supabase' ? <Icon name="spark" /> : id === 'vercel' ? <span className="vercel-mini" /> : name.slice(0, 1)}
    </span>
  );
}

export function ConnectorPicker({ connectors, up }: { connectors: Connector[]; up?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedConnectors = useUiStore((s) => s.selectedConnectors);
  const toggleConnector = useUiStore((s) => s.toggleConnector);
  const removeConnector = useUiStore((s) => s.removeConnector);
  const byId = useMemo(() => new Map(connectors.map((connector) => [connector.id, connector])), [connectors]);
  const selected = CONNECTOR_CATALOG.filter((connector) => selectedConnectors.includes(connector.id) && byId.get(connector.id)?.connected);
  const availableCount = CONNECTOR_CATALOG.filter((connector) => byId.get(connector.id)?.connected).length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // A connector may be disconnected in settings after it was selected for a
  // draft. Clear that stale selection once the server has returned its catalog.
  useEffect(() => {
    if (!connectors.length) return;
    const connectedIds = new Set(connectors.filter((connector) => connector.connected).map((connector) => connector.id));
    selectedConnectors.forEach((id) => { if (!connectedIds.has(id)) removeConnector(id); });
  }, [connectors, selectedConnectors, removeConnector]);

  return (
    <div className="dd connector-picker" ref={ref}>
      <button
        type="button"
        className={selected.length ? 'conn-pill' : 'circle'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={selected.length ? `${selected.length} connector${selected.length === 1 ? '' : 's'} selected` : 'Choose connectors'}
        title={selected.length ? `${selected.length} connector${selected.length === 1 ? '' : 's'} selected` : 'Choose connectors'}
        onClick={() => setOpen((value) => !value)}
      >
        {selected.length
          ? <>{selected.slice(0, 3).map((connector) => <ConnLogo key={connector.id} id={connector.id} name={connector.name} />)}{selected.length > 3 && <span className="more">+{selected.length - 3}</span>}</>
          : <Icon name="plug" />}
      </button>
      {open && (
        <div className={`menu conn-menu ${up ? 'up' : ''}`} role="dialog" aria-label="Connectors for this task">
          <div className="connector-menu-heading">
            <div><b>Use with this task</b><small>{availableCount ? `${availableCount} connected integration${availableCount === 1 ? '' : 's'} available` : connectors.length ? 'Connect an integration to get started' : 'Checking your integrations…'}</small></div>
            {selected.length > 0 && <span className="selected-count">{selected.length} selected</span>}
          </div>
          <div className="connector-menu-list">
            {CONNECTOR_CATALOG.map((connector) => {
              const live = byId.get(connector.id);
              const connected = !!live?.connected;
              return connected ? (
                <label className={`crow connector-choice ${selectedConnectors.includes(connector.id) ? 'chosen' : ''}`} key={connector.id}>
                  <ConnLogo id={connector.id} name={connector.name} />
                  <span className="txt"><b>{connector.name}</b><small>{connector.description}</small></span>
                  <span className="switch"><input type="checkbox" checked={selectedConnectors.includes(connector.id)} onChange={() => toggleConnector(connector.id)} aria-label={`Use ${connector.name} for this task`} /><span /></span>
                </label>
              ) : (
                <div className="crow connector-choice unavailable" key={connector.id}>
                  <ConnLogo id={connector.id} name={connector.name} />
                  <span className="txt"><b>{connector.name}</b><small>Connect to use</small></span>
                  <Link className="connector-setup-link" to="/connections" onClick={() => setOpen(false)} aria-label={`Connect ${connector.name}`}><Icon name="plus" /></Link>
                </div>
              );
            })}
          </div>
          <Link className="mf" to="/connections" onClick={() => setOpen(false)}>
            <span>Manage integrations</span><Icon name="chevr" />
          </Link>
        </div>
      )}
    </div>
  );
}
