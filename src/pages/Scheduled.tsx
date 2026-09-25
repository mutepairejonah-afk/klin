import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { schedulesApi } from '@/lib/api';
import { JOB_TEMPLATES, jobById } from '@/lib/jobs';
import type { Schedule } from '@/lib/types';

export default function Scheduled() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [open, setOpen] = useState(false);
  const toast = useToast((s) => s.show);

  function refresh() { schedulesApi.list().then(setSchedules).catch(() => setSchedules([])); }
  useEffect(refresh, []);

  return (
    <>
      <HeaderLeft><span className="h-title">Scheduled</span></HeaderLeft>
      <HeaderRight><button className="btn pri" onClick={() => setOpen(true)}><Icon name="plus" />New schedule</button></HeaderRight>
      <div className="wrap">
        <div className="pg-h"><div><h1 className="h1">Scheduled</h1><p className="sub">Recurring jobs. Each run starts a fresh session.</p></div></div>
        {schedules.length === 0
          ? <div style={{ marginTop: 22 }}><EmptyState icon="clock" title="No schedules yet">Set a job to repeat on its own.
              <div style={{ marginTop: 14 }}><button className="btn pri" onClick={() => setOpen(true)}>New schedule</button></div></EmptyState></div>
          : (
            <div className="card" style={{ marginTop: 22 }}>
              {schedules.map((s) => (
                <div className="row-item" key={s.id}>
                  <span className="ico-sq"><Icon name={jobById(s.jobId)?.icon ?? 'clock'} /></span>
                  <div className="txt"><b style={{ fontWeight: 500 }}>{s.name}</b><small>{jobById(s.jobId)?.name}{s.repo ? ` · ${s.repo}` : ''} · {s.cadenceLabel}</small></div>
                  {s.nextRunAt && <div className="muted hide-sm" style={{ textAlign: 'right', fontSize: 13.5 }}>Next run<br /><span style={{ color: 'var(--text)' }}>{s.nextRunAt}</span></div>}
                  <label className="switch">
                    <input type="checkbox" checked={s.enabled} onChange={(e) => schedulesApi.update(s.id, { enabled: e.target.checked }).then(refresh).catch(() => toast('Backend not connected yet'))} aria-label={`Enable ${s.name}`} />
                    <span />
                  </label>
                </div>
              ))}
            </div>
          )}
      </div>
      {open && <Modal onClose={() => setOpen(false)}><NewScheduleForm onDone={() => { setOpen(false); refresh(); }} onClose={() => setOpen(false)} /></Modal>}
    </>
  );
}

function NewScheduleForm({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const [name, setName] = useState('');
  const [jobId, setJobId] = useState(JOB_TEMPLATES[0].id);
  const [repo, setRepo] = useState('');
  const [cadenceLabel, setCadenceLabel] = useState('Every day, 02:00');
  return (
    <>
      <h2>New schedule</h2>
      <p className="s">Run a job automatically. Approval rules still apply.</p>
      <div className="field"><label>Name</label><input className="input w" placeholder="Name this schedule" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div style={{ display: 'flex', gap: 14 }}>
        <div className="field" style={{ flex: 1 }}><label>Job</label>
          <select className="input" value={jobId} onChange={(e) => setJobId(e.target.value)}>{JOB_TEMPLATES.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}</select>
        </div>
        <div className="field" style={{ flex: 1 }}><label>Repository</label><input className="input" placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} /></div>
      </div>
      <div className="field"><label>Repeats</label>
        <select className="input" value={cadenceLabel} onChange={(e) => setCadenceLabel(e.target.value)}>
          <option>Every day, 02:00</option><option>Every Monday, 09:00</option><option>First of the month</option>
        </select>
      </div>
      <div className="foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn pri" onClick={() => {
          schedulesApi.create({ name: name || 'Untitled schedule', jobId, repo, cadenceLabel, cadenceCron: '', enabled: true })
            .then(onDone).catch(() => toast('Backend not connected yet'));
        }}>Save schedule</button>
      </div>
    </>
  );
}
