import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import type { PreviewItem } from '@/lib/previews';

type Device = 'desktop' | 'tablet' | 'phone';
const DEVICES: { key: Device; icon: string; label: string; width: string }[] = [
  { key: 'desktop', icon: 'monitor', label: 'Desktop', width: '100%' },
  { key: 'tablet', icon: 'tablet', label: 'Tablet', width: '768px' },
  { key: 'phone', icon: 'phone', label: 'Mobile', width: '390px' },
];

function withScheme(url: string) { return /^https?:/.test(url) ? url : `https://${url}`; }

export function DesignPreview({
  items, activeId, onSelect, onClose, expanded, onExpand, onShowComputer,
}: {
  items: PreviewItem[]; activeId: string; onSelect: (id: string) => void; onClose: () => void;
  expanded?: boolean; onExpand?: () => void; onShowComputer?: () => void;
}) {
  const item = items.find((i) => i.id === activeId) ?? items[items.length - 1];
  const [view, setView] = useState<'preview' | 'code'>('preview');
  const [device, setDevice] = useState<Device>('desktop');
  const [menu, setMenu] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const off = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [menu]);

  const blobUrl = useMemo(() => {
    if (!item || item.kind !== 'html' || !item.html) return null;
    return URL.createObjectURL(new Blob([item.html], { type: 'text/html' }));
  }, [item?.id, item?.html]);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  if (!item) return null;
  const width = DEVICES.find((d) => d.key === device)!.width;
  const external = item.kind === 'url' ? withScheme(item.url!) : blobUrl;

  function copySource() {
    const text = item.source ?? item.url ?? '';
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); });
  }

  return (
    <div className="dp">
      <div className="dp-h">
        <div className="dp-title" ref={menuRef}>
          <button className="dp-name" onClick={() => items.length > 1 && setMenu((v) => !v)} aria-haspopup="listbox" aria-expanded={menu}>
            <span className="t">{item.title}</span>
            {items.length > 1 && <Icon name="chev" />}
          </button>
          {menu && (
            <div className="dp-menu" role="listbox">
              {items.map((i) => (
                <button key={i.id} role="option" aria-selected={i.id === item.id} className={i.id === item.id ? 'on' : ''}
                  onClick={() => { onSelect(i.id); setMenu(false); setView('preview'); }}>
                  <Icon name={i.kind === 'url' ? 'globe' : 'doc'} /><span>{i.title}</span>
                  <small>{i.path ?? 'Deployed preview'}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <span style={{ flex: 1 }} />
        {item.kind === 'html' && (
          <div className="dp-seg" role="tablist" aria-label="View">
            <button role="tab" aria-selected={view === 'preview'} className={view === 'preview' ? 'on' : ''} onClick={() => setView('preview')} aria-label="Preview"><Icon name="eye" /></button>
            <button role="tab" aria-selected={view === 'code'} className={view === 'code' ? 'on' : ''} onClick={() => setView('code')} aria-label="Code"><Icon name="code" /></button>
          </div>
        )}
        {view === 'preview' && (
          <div className="dp-seg hide-sm" role="group" aria-label="Device">
            {DEVICES.map((d) => (
              <button key={d.key} className={device === d.key ? 'on' : ''} onClick={() => setDevice(d.key)} aria-label={d.label} title={d.label}><Icon name={d.icon} /></button>
            ))}
          </div>
        )}
        {view === 'preview' && <button className="icon-btn" aria-label="Reload" title="Reload" onClick={() => setNonce((n) => n + 1)}><Icon name="refresh" /></button>}
        <button className="icon-btn" aria-label="Copy" title={copied ? 'Copied' : 'Copy'} onClick={copySource}><Icon name={copied ? 'check' : 'copy'} /></button>
        {external && <a className="icon-btn" aria-label="Open in new tab" title="Open in new tab" href={external} target="_blank" rel="noopener noreferrer"><Icon name="ext" /></a>}
        {onShowComputer && <button className="icon-btn" aria-label="Agent workspace" title="Agent workspace" onClick={onShowComputer}><Icon name="terminal" /></button>}
        {onExpand && <button className="icon-btn hide-sm" aria-label={expanded ? 'Exit full screen' : 'Full screen'} onClick={onExpand}><Icon name={expanded ? 'min' : 'max'} /></button>}
        <button className="icon-btn" aria-label="Close preview" onClick={onClose}><Icon name="x" /></button>
      </div>

      <div className="dp-body">
        {view === 'code' && item.kind === 'html' ? (
          <pre className="dp-code mono">{item.source}</pre>
        ) : (
          <div className={`dp-stage ${device}`}>
            <div className="dp-frame" style={{ width }}>
              {item.kind === 'html' ? (
                // No allow-same-origin: agent-written pages run isolated from the app.
                <iframe key={nonce} title={item.title} srcDoc={item.html} sandbox="allow-scripts allow-forms allow-popups allow-modals" />
              ) : (
                <iframe key={nonce} title={item.title} src={withScheme(item.url!)} sandbox="allow-scripts allow-forms allow-popups allow-same-origin" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** The inline card that sits in the thread, like Claude's artifact chip. */
export function ArtifactCard({ item, open, onToggle }: { item: PreviewItem; open: boolean; onToggle: () => void }) {
  return (
    <div className="art-card">
      <span className="ico-sq"><Icon name="artifact" /></span>
      <span className="txt"><b>{item.title}</b><small>Artifact · {item.kind === 'url' ? 'Deployed preview' : 'Only you'}</small></span>
      <button className="btn sm" onClick={onToggle}>{open ? 'Hide' : 'Open'}</button>
    </div>
  );
}
