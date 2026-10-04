import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { JOB_TEMPLATES } from '@/lib/jobs';
import type { JobTemplate } from '@/lib/types';

export function JobPicker({ onSelect, selectedId, up }: {
  onSelect: (job: JobTemplate) => void;
  selectedId?: string | null;
  up?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => JOB_TEMPLATES.find((job) => job.id === selectedId), [selectedId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="dd job-picker" ref={ref}>
      <button
        type="button"
        className={`conn-pill job-picker-trigger ${selected ? 'selected' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={selected ? `Job workflow: ${selected.name}` : 'Choose a job workflow'}
        title={selected ? `Selected workflow: ${selected.name}` : 'Choose a job workflow'}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="list" />
        <span>Jobs</span>
        {selected && <span className="job-picker-current">{selected.shortLabel}</span>}
        <Icon name="chev" className="job-picker-chevron" />
      </button>
      {open && (
        <div className={`menu job-menu ${up ? 'up' : ''}`} role="dialog" aria-label="Available job workflows">
          <div className="job-menu-heading">
            <b>Choose a workflow</b>
            <small>Templates stay available while you work.</small>
          </div>
          <div className="job-menu-list">
            {JOB_TEMPLATES.map((job) => (
              <button
                type="button"
                key={job.id}
                className={`job-choice ${selectedId === job.id ? 'selected' : ''}`}
                aria-pressed={selectedId === job.id}
                onClick={() => { onSelect(job); setOpen(false); }}
              >
                <span className="job-choice-icon"><Icon name={job.icon} /></span>
                <span className="job-choice-copy">
                  <b>{job.name}</b>
                  <small>{job.description}</small>
                </span>
                {selectedId === job.id && <Icon name="check" className="job-choice-check" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
