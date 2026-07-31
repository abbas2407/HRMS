import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import vendorApi from '@/lib/vendor-api';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { IconSearch } from '@tabler/icons-react';

const actionColors: Record<string, 'blue' | 'success' | 'danger' | 'warning' | 'gray'> = {
  CREATE_TENANT: 'success',
  UPDATE_STATUS: 'warning',
  EXTEND_TRIAL: 'blue',
  RECORD_PAYMENT: 'success',
  IMPERSONATE: 'danger',
  UPDATE_SUBSCRIPTION: 'blue',
  LOGIN: 'gray',
};

export default function VendorAuditLog() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-audit-log'],
    queryFn: () => vendorApi.get('/billing/audit-log').then(r => r.data.data),
  });

  const rows = (data || []).filter((r: any) =>
    !search ||
    r.targetName?.toLowerCase().includes(search.toLowerCase()) ||
    r.action?.toLowerCase().includes(search.toLowerCase()) ||
    r.performedBy?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Audit Log" breadcrumb={['Vendor', 'Audit Log']} />

      <div style={{ marginBottom: 16, position: 'relative', maxWidth: 320 }}>
        <IconSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input
          placeholder="Search actions, companies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '6px 10px 6px 30px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)' }}>
              {['Time', 'Action', 'Company', 'Performed By', 'Details'].map(h => (
                <th key={h} className="th-label" style={{ padding: '8px 16px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ padding: 16 }}><SkeletonTable rows={8} cols={5} /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No audit logs found</td></tr>
            ) : (
              rows.map((r: any) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                    {new Date(r.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge variant={actionColors[r.action] || 'gray'} dot={false}>
                      <span style={{ fontSize: 11 }}>{r.action?.replace(/_/g, ' ')}</span>
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12.5 }}>{r.targetName || '—'}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-2)' }}>{r.performedBy}</td>
                  <td style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--text-3)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.details ? JSON.stringify(r.details) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
