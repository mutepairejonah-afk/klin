import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import Icon from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { useSessions } from '@/hooks/useSessions';
import { jobById } from '@/lib/jobs';
import type { SessionStatus } from '@/lib/types';

const TABS: { key: SessionStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'executing', label: 'Running' },
  { key: 'waiting_approval', label: 'Needs approval' },
  { key: 'done', label: 'Done' },
  { key: 'failed', label: 'Failed' },
];

export default function Sessions() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const f = (params.get('status') as SessionStatus | 'all') || 'all';
  const { sessions, loading } = useSessions(f === 'all' ? undefined : { status: f });

  return (
    <>
      <HeaderLeft><span className="h-title">Sessions</span></HeaderLeft>
      <HeaderRight><Link className="btn pri hide-sm" to="/"><Icon name="plus" />New task</Link></HeaderRight>
      <div className="wrap">
        <div className="pg-h">
          <div><h1 className="h1">Sessions</h1><p className="sub">Every job the agent has run. Open one to watch it live or replay it.</p></div>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`tab ${f === t.key ? 'on' : ''}`} onClick={() => setParams(t.key === 'all' ? {} : { status: t.key })}>
              {t.label}
            </button>
          ))}
        </div>
        {!loading && sessions.length === 0 && (
          <EmptyState icon="agent" title="No sessions here yet">Start a task and it will show up in this list.
            <div style={{ marginTop: 14 }}><Link className="btn pri" to="/">New task</Link></div>
          </EmptyState>
        )}
        {sessions.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Task</th><th>Repository</th><th>Job</th><th>Status</th><th>Duration</th><th>Cost</th></tr></thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} data-go onClick={() => nav(`/s/${s.id}`)}>
                    <td>{s.goal}</td>
                    <td className="mono" style={{ fontSize: 13 }}>{s.repo || '—'}</td>
                    <td>{jobById(s.jobId)?.name ?? '—'}</td>
                    <td><span className="badge">{s.status}</span></td>
                    <td>{s.durationSec ? `${Math.round(s.durationSec / 60)} min` : '—'}</td>
                    <td>{s.costUsd != null ? `$${s.costUsd.toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
