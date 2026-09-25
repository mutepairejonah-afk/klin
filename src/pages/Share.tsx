import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '@/components/Icon';
import { RoleBar, ThreadPanel } from '@/components/ThreadPanel';
import { ComputerPanel } from '@/components/ComputerPanel';
import { BRAND } from '@/lib/brand';
import { shareApi } from '@/lib/api';
import { useSessionEvents } from '@/hooks/useSessionEvents';
import { statusFromFold } from '@/lib/sessionReducer';
import type { Session } from '@/lib/types';

export default function Share() {
  const { token = '' } = useParams();
  const [meta, setMeta] = useState<Session | null>(null);
  const [missing, setMissing] = useState(false);
  const [showComp, setShowComp] = useState(false);
  const [tab, setTab] = useState('terminal');
  const { visibleEvents, state } = useSessionEvents(token, { mode: 'share', shareToken: token });

  useEffect(() => { shareApi.get(token).then(setMeta).catch(() => setMissing(true)); }, [token]);

  if (missing) {
    return (
      <div className="bare">
        <div className="share-bar"><Link className="brand" to="/"><span style={{ fontFamily: '"Instrument Serif",serif', fontSize: 24 }}>{BRAND.name}.</span></Link></div>
        <div className="center">
          <div className="card empty" style={{ maxWidth: 420 }}>
            <div className="ico-sq"><Icon name="link" /></div>
            <b>This shared session isn’t available</b>The link may have expired or sharing was turned off.
          </div>
        </div>
      </div>
    );
  }
  if (!meta) return null;
  const status = statusFromFold(state, meta.status);

  return (
    <div className="bare">
      <div className="share-bar">
        <Link className="brand" to="/"><span style={{ fontFamily: '"Instrument Serif",serif', fontSize: 24 }}>{BRAND.name}.</span></Link>
        <span className="badge hide-xs">Shared session · read-only</span>
        <span className="h-title goal hide-sm" style={{ flex: 1 }}>{meta.goal}</span>
        <span style={{ flex: 1 }} />
        <button className="btn sm only-m" onClick={() => setShowComp((v) => !v)}><Icon name="monitor" /><span className="hide-xs">Computer</span></button>
        <Link className="btn sm" to="/">Try it yourself</Link>
      </div>
      <div className={`sess-host sess ${showComp ? 'show-comp' : ''}`}>
        <section className="thread-col">
          <RoleBar state={state} status={status} />
          <div className="thr-scroll"><ThreadPanel goal={meta.goal} state={state} status={status} onTab={setTab} onApprove={() => {}} extraMessages={[]} /></div>
        </section>
        <section className="comp-col">
          <div className="comp"><ComputerPanel state={state} status={status} activeTab={tab} onTab={setTab} events={visibleEvents} onSelectFile={() => {}} /></div>
        </section>
      </div>
    </div>
  );
}
