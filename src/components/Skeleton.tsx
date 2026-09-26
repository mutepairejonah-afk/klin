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
