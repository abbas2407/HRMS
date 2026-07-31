import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  breadcrumb?: string[];
  actions?: ReactNode;
}

export default function PageHeader({ title, breadcrumb, actions }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        {breadcrumb && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
            {breadcrumb.join(' / ')}
          </div>
        )}
        <h1>{title}</h1>
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}
