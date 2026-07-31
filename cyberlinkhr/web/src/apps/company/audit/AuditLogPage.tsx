import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { IconShieldCheck, IconSearch } from '@tabler/icons-react';

const ACTION_LABELS: Record<string, string> = {
  'ticket.created': 'Ticket Created', 'ticket.resolved': 'Ticket Resolved',
  'ticket.closed': 'Ticket Closed', 'ticket.in_progress': 'Ticket In Progress',
  'ticket.waiting': 'Ticket Waiting', 'expense.submitted': 'Expense Submitted',
  'expense.approved': 'Expense Approved', 'expense.rejected': 'Expense Rejected',
  'expense.reimbursed': 'Expense Reimbursed', 'grievance.raised': 'Grievance Raised',
  'grievance.closed': 'Grievance Closed', 'payroll.locked': 'Payroll Locked',
  'payroll.published': 'Payroll Published', 'leave.approved': 'Leave Approved',
  'leave.rejected': 'Leave Rejected',
};

const ACTION_COLORS: Record<string, string> = {
  created: '#22c55e', submitted: '#3b82f6', approved: '#22c55e', reimbursed: '#8b5cf6',
  rejected: '#ef4444', closed: '#6b7280', resolved: '#22c55e', locked: '#f59e0b',
  published: '#3b82f6', in_progress: '#f59e0b', waiting: '#f59e0b', raised: '#ef4444',
};

function actionColor(action: string) {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return color;
  }
  return '#6b7280';
}

export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const { data: logs, isLoading } = useQuery<any[]>({
    queryKey: ['audit-logs'],
    queryFn: () => api.get('/notifications/audit-logs').then(r => r.data.data),
  });

  const entities = [...new Set((logs || []).map((l: any) => l.entity).filter(Boolean))];

  const filtered = (logs || []).filter((l: any) => {
    const s = search.toLowerCase();
    const matchSearch = !s ||
      l.action?.toLowerCase().includes(s) ||
      l.userEmail?.toLowerCase().includes(s) ||
      l.entity?.toLowerCase().includes(s) ||
      l.details?.toLowerCase().includes(s);
    const matchEntity = !entityFilter || l.entity === entityFilter;
    return matchSearch && matchEntity;
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <IconShieldCheck size={22} color="var(--color-primary)" />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Audit Log</h1>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Complete record of all system actions
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <IconSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by action, user, entity..."
            style={{ width: '100%', paddingLeft: 32, padding: '8px 12px 8px 32px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, background: 'var(--color-surface)', color: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, background: 'var(--color-surface)', color: 'inherit', minWidth: 150 }}>
          <option value="">All entities</option>
          {entities.map(e => (
            <option key={e} value={e}>{e?.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : !filtered.length ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
          No audit records found.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                {['Action', 'Entity', 'Details', 'User', 'IP Address', 'Date & Time'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l: any, idx: number) => (
                <tr key={l.id}
                  style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--color-border)' : 'none', verticalAlign: 'top' }}>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                      background: actionColor(l.action) + '18', color: actionColor(l.action),
                    }}>
                      {ACTION_LABELS[l.action] || l.action}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {l.entity ? l.entity.replace(/_/g, ' ') : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', maxWidth: 260 }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{l.details || '—'}</span>
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 500 }}>{l.userEmail || '—'}</div>
                    {l.userRole && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{l.userRole}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                    {l.ipAddress || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                    <div>{new Date(l.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>{new Date(l.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-secondary)' }}>
        Showing {filtered.length} of {(logs || []).length} records (last 100)
      </div>
    </div>
  );
}
