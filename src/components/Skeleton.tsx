// Facebook-style shimmer placeholders shown while data is loading, sized
// to match the real content they stand in for so nothing jumps when the
// real data arrives. See .skel / @keyframes skel-shimmer in globals.css.

import type { CSSProperties } from 'react';

export function Skeleton({ width, height = 13, radius = 6, style }: { width: number | string; height?: number; radius?: number; style?: CSSProperties }) {
  return <span className="skel skel-line" style={{ width, height, borderRadius: radius, ...style }} />;
}

/** Matches Sessions.tsx's <table> rows. */
export function SessionRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Task</th><th>Repository</th><th>Job</th><th>Status</th><th>Duration</th><th>Cost</th></tr></thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td><Skeleton width={`${60 + ((i * 13) % 30)}%`} /></td>
              <td><Skeleton width={90} /></td>
              <td><Skeleton width={70} /></td>
              <td><Skeleton width={64} height={20} radius={10} /></td>
              <td><Skeleton width={40} /></td>
              <td><Skeleton width={36} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Matches Home.tsx's "Recent sessions" .rcard rows. */
export function RecentSessionsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="rcard" key={i} style={{ cursor: 'default' }}>
          <span className="skel skel-circle" style={{ width: 32, height: 32 }} />
          <span className="txt" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Skeleton width={`${50 + ((i * 17) % 35)}%`} height={14} />
            <Skeleton width={140} height={11} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Generic `.row-item` skeleton — Scheduled, Settings (members/secrets), Memory's repo/user/org lists. */
export function RowItemsSkeleton({ rows = 3, square = true }: { rows?: number; square?: boolean }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div className="row-item" key={i}>
          {square ? <span className="skel" style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0 }} /> : <span className="skel skel-circle" style={{ width: 30, height: 30 }} />}
          <div className="txt" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Skeleton width={`${40 + ((i * 19) % 30)}%`} height={13} />
            <Skeleton width={`${20 + ((i * 11) % 20)}%`} height={11} />
          </div>
        </div>
      ))}
    </>
  );
}

/** Generic table skeleton — Audit log's 6-column table. */
export function TableRowsSkeleton({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}><Skeleton width={c === 0 ? 120 : `${40 + ((r + c) * 13) % 45}%`} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Usage page's KPI card grid. */
export function KpisSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div className="card kpi" style={{ padding: '16px 18px' }} key={i}>
          <Skeleton width="70%" height={13} />
          <div style={{ margin: '10px 0 6px' }}><Skeleton width="45%" height={26} /></div>
          <Skeleton width="55%" height={11} />
        </div>
      ))}
    </>
  );
}

/** Sidebar's mini recent-sessions list — smaller than the full-page version. */
export function SidebarSessionsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px' }}>
          <span className="skel" style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0 }} />
          <Skeleton width={`${55 + ((i * 15) % 30)}%`} height={12} />
        </div>
      ))}
    </>
  );
}

/** Full-page skeleton for SessionView/Share while the session's metadata is still loading — mirrors the .sess two-pane layout so nothing reflows once real data arrives. */
export function SessionViewSkeleton() {
  return (
    <div className="sess">
      <section className="thread-col">
        <div className="thr-scroll" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Skeleton width="80%" height={16} />
          <Skeleton width="55%" height={13} />
          <div style={{ marginTop: 10 }}><Skeleton width="100%" height={70} radius={10} /></div>
          <Skeleton width="65%" height={13} />
          <Skeleton width="40%" height={13} />
        </div>
      </section>
      <section className="comp-col">
        <div className="comp" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton width="30%" height={14} />
          <Skeleton width="100%" height={200} radius={10} />
        </div>
      </section>
    </div>
  );
}
