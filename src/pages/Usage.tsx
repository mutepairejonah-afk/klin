import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { usageApi } from '@/lib/api';
import type { UsageSummary } from '@/lib/types';

function Kpi({ label, value, target }: { label: string; value: string; target: string }) {
  return <div className="card kpi" style={{ padding: '16px 18px' }}><div className="l muted" style={{ fontSize: 13.5 }}>{label}</div><div className="v" style={{ fontSize: 28, fontWeight: 600, margin: '6px 0 2px' }}>{value}</div><div className="tg muted" style={{ fontSize: 12.5 }}>{target}</div></div>;
}

export default function Usage() {
  const [u, setU] = useState<UsageSummary | null>(null);
  useEffect(() => { usageApi.get().then(setU).catch(() => setU(null)); }, []);
  const pct = (n?: number) => (n != null ? `${Math.round(n * 100)}%` : '—');
  return (
    <>
      <HeaderLeft><span className="h-title">Usage and credits</span></HeaderLeft>
      <HeaderRight />
      <div className="wrap">
        <div className="pg-h"><div><h1 className="h1">Usage and credits</h1><p className="sub">Tokens and compute time per session, and how the agent is performing against its targets.</p></div></div>
        <div className="card pad" style={{ margin: '22px 0 14px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span className="ico-sq"><Icon name="spark" /></span>
          <div style={{ flex: 1, minWidth: 200 }}><b style={{ fontWeight: 600 }}>{u ? 'Credits' : 'No usage yet'}</b>
            <div className="muted" style={{ fontSize: 14 }}>Credits and spend appear here once the agent has run a job.</div></div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(200px,100%),1fr))' }}>
          <Kpi label="Job completion rate" value={pct(u?.jobCompletionRate)} target="Target above 70%" />
          <Kpi label="PR merge rate" value={pct(u?.prMergeRate)} target="Target above 50%" />
          <Kpi label="Median session time" value={u?.medianSessionSec ? `${Math.round(u.medianSessionSec / 60)} min` : '—'} target="Target under 20 min" />
          <Kpi label="Approval prompt rate" value={pct(u?.approvalPromptRate)} target="Target under 20%" />
          <Kpi label="Cost per successful job" value={u?.costPerJobUsd != null ? `$${u.costPerJobUsd.toFixed(2)}` : '—'} target="Target under $2" />
          <Kpi label="Secret leaks" value={u?.secretLeaks != null ? String(u.secretLeaks) : '—'} target="Target zero" />
        </div>
        <h3 style={{ margin: '26px 0 10px', fontSize: 16 }}>Most expensive sessions</h3>
        <div className="card empty">{u?.topSessions?.length ? null : 'No sessions yet'}</div>
      </div>
    </>
  );
}
