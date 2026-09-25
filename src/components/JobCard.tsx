import Icon from './Icon';
import type { JobTemplate } from '@/lib/types';

export function JobCard({ job, onClick }: { job: JobTemplate; onClick: () => void }) {
  return (
    <button className="jobcard" onClick={onClick}>
      <Icon name={job.icon} />
      <b>{job.shortLabel}</b>
      <small>{job.inputLabel} → {job.outputLabel}</small>
    </button>
  );
}
