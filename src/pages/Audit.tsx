import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { auditApi } from '@/lib/api';
import type { AuditEntry } from '@/lib/types';

export default function Audit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  useEffect(() => { auditApi.list().then(setEntries).catch(() => setEntries([])); }, []);
  return (
    <>
      <HeaderLeft><span className="h-title">Audit log</span></HeaderLeft>
      <HeaderRight />
      <div className="wrap">
        <div className="pg-h"><div><h1 className="h1">Audit log</h1><p className="sub">Every external write (GitHub, database, deploy) and every approval, in a signed, append-only chain.</p></div></div>
        {entries.length === 0
          ? <div className="card empty" style={{ marginTop: 22 }}><div className="ico-sq"><Icon name="shield" /></div><b>No entries yet</b>External writes and approvals will be recorded here.</div>
          : (
            <div className="table-wrap" style={{ marginTop: 22 }}>
              <table>
                <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Session</th><th>Detail</th><th>IP</th></tr></thead>
                <tbody>{entries.map((r) => (
                  <tr key={r.id}>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{r.ts}</td><td>{r.actor}</td>
                    <td className="mono" style={{ fontSize: 13 }}>{r.action}</td>
                    <td>{r.sessionId ? <Link to={`/s/${r.sessionId}`} className="mono" style={{ fontSize: 13, textDecoration: 'underline' }}>{r.sessionId}</Link> : '—'}</td>
                    <td>{r.detail}</td><td className="muted mono" style={{ fontSize: 12.5 }}>{r.ip}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
      </div>
    </>
  );
}
