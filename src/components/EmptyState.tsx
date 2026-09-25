import type { ReactNode } from 'react';
import Icon from './Icon';

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="card empty">
      <div className="ico-sq"><Icon name={icon} /></div>
      <b>{title}</b>
      {children}
    </div>
  );
}
