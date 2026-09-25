import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { CONNECTOR_CATALOG } from '@/lib/connectorCatalog';
import { useUiStore } from '@/lib/store';
import type { Connector } from '@/lib/types';

function ConnLogo({ id, name }: { id: string; name: string }) {
  return <span className="cl">{id === 'github' ? <Icon name="gh" /> : name[0]}</span>;
}

// `connectors` = the merged, backend-truth connection state (connected or
// not). Until that's wired, pass an empty array and every connector shows
// "Connect" (linking to /connections) rather than a toggle.
export function ConnectorPicker({ connectors, up }: { connectors: Connector[]; up?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { selectedConnectors, toggleConnector } = useUiStore();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const byId = new Map(connectors.map((c) => [c.id, c]));
  const selected = CONNECTOR_CATALOG.filter((c) => selectedConnectors.includes(c.id));

  return (
    <div className="dd" ref={ref}>
      <button
        className={selected.length ? 'conn-pill' : 'circle'}
        aria-haspopup="menu" aria-label="Choose connectors" title="Connectors"
        onClick={() => setOpen((v) => !v)}
      >
        {selected.length
          ? <>{selected.slice(0, 3).map((c) => <ConnLogo key={c.id} id={c.id} name={c.name} />)}
            {selected.length > 3 && <span className="more">+{selected.length - 3}</span>}</>
          : <Icon name="plug" />}
      </button>
      {open && (
        <div className={`menu conn-menu ${up ? 'up' : ''}`} role="menu">
          <div className="mh">Connectors for this task</div>
          {CONNECTOR_CATALOG.map((c) => {
            const live = byId.get(c.id);
            const connected = !!live?.connected;
            return connected ? (
              <label className="crow" key={c.id}>
                <ConnLogo id={c.id} name={c.name} />
                <span className="txt"><b style={{ fontWeight: 500 }}>{c.name}</b><small>{c.description}</small></span>
                <span className="switch">
                  <input type="checkbox" checked={selectedConnectors.includes(c.id)} onChange={() => toggleConnector(c.id)} aria-label={`Use ${c.name}`} />
                  <span />
                </span>
              </label>
            ) : (
              <div className="crow off" key={c.id}>
                <ConnLogo id={c.id} name={c.name} />
                <span className="txt"><b style={{ fontWeight: 500 }}>{c.name}</b><small>Not connected</small></span>
                <Link className="btn sm" to="/connections" onClick={() => setOpen(false)}>Connect</Link>
              </div>
            );
          })}
          <Link className="mf" to="/connections" onClick={() => setOpen(false)}>
            <span>Manage connectors</span><Icon name="chevr" />
          </Link>
        </div>
      )}
    </div>
  );
}
