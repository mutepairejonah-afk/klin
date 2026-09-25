import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/Icon';
import { HeaderLeft, HeaderRight } from '@/components/HeaderPortal';
import { Drawer } from '@/components/Modal';
import { JOB_TEMPLATES } from '@/lib/jobs';
import { useUiStore } from '@/lib/store';
import type { JobTemplate } from '@/lib/types';

export default function Jobs() {
  const [open, setOpen] = useState<JobTemplate | null>(null);
  const nav = useNavigate();
  const { setSelectedJobId } = useUiStore();

  return (
    <>
      <HeaderLeft><span className="h-title">Jobs</span></HeaderLeft>
      <HeaderRight />
      <div className="wrap">
        <div className="pg-h">
          <div><h1 className="h1">Jobs</h1><p className="sub">Ready-made job types. Each ships with a planner prompt, success criteria, required tools, approval rules and verifier checks.</p></div>
        </div>
        <div className="grid g3" style={{ marginTop: 22 }}>
          {JOB_TEMPLATES.map((j) => (
            <button key={j.id} className="card pad" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }} onClick={() => setOpen(j)}>
              <span className="ico-sq"><Icon name={j.icon} /></span>
              <span><b style={{ fontWeight: 600, fontSize: 16, display: 'block' }}>{j.name}</b><span className="muted" style={{ fontSize: 14 }}>{j.description}</span></span>
              <span className="muted" style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', marginTop: 'auto' }}>
                {j.inputLabel} <Icon name="arrow" /> {j.outputLabel}
              </span>
            </button>
          ))}
        </div>
      </div>
      {open && (
        <Drawer onClose={() => setOpen(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="ico-sq"><Icon name={open.icon} /></span>
            <button className="icon-btn" aria-label="Close" onClick={() => setOpen(null)}><Icon name="x" /></button>
          </div>
          <h2 style={{ margin: '14px 0 4px' }}>{open.name}</h2>
          <p className="muted" style={{ margin: 0 }}>{open.description}</p>
          <h4>Input and output</h4>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="badge">{open.inputLabel}</span><Icon name="arrow" /><span className="badge ok">{open.outputLabel}</span>
          </div>
          <h4>Success criteria</h4>
          <ul>{open.criteria.map((c) => <li key={c}>{c}</li>)}</ul>
          <h4>Required tools</h4>
          <div className="chips">{open.tools.map((t) => <span className="badge" key={t}>{t}</span>)}</div>
          <h4>Asks for approval before</h4>
          {open.approvals.length ? <ul>{open.approvals.map((a) => <li key={a}>{a}</li>)}</ul> : <span className="muted">None required</span>}
          <h4>Verifier checks</h4>
          <ul>{open.checks.map((c) => <li key={c}>{c}</li>)}</ul>
          <div style={{ display: 'flex', gap: 8, marginTop: 26 }}>
            <button className="btn pri" onClick={() => { setSelectedJobId(open.id); setOpen(null); nav('/'); }}>Start this job</button>
            <button className="btn" onClick={() => setOpen(null)}>Close</button>
          </div>
        </Drawer>
      )}
    </>
  );
}
