import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import Badge, { statusToBadge } from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import { SkeletonTable } from '@/components/ui/Skeleton';
import AddEmployeeModal from './AddEmployeeModal';
import { IconPlus, IconSearch, IconUser } from '@tabler/icons-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SEPARATED', label: 'Resigned' },
];

export default function EmployeeListPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['employees', search, statusFilter, deptFilter, page],
    queryFn: () => api.get('/employees', {
      params: {
        search: search || undefined,
        status: statusFilter || undefined,
        departmentId: deptFilter || undefined,
        page,
        limit: 25,
      }
    }).then(r => r.data),
    placeholderData: prev => prev,
  });

  const rows = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 25 };

  const empTypeBadge = (type: string) => {
    const map: Record<string, 'blue' | 'gray' | 'warning' | 'purple'> = {
      FULL_TIME: 'blue', PART_TIME: 'gray', CONTRACT: 'warning', INTERN: 'purple',
    };
    return map[type] || 'gray';
  };

  return (
    <div>
      <PageHeader
        title="Employees"
        breadcrumb={['HR', 'Employees']}
        actions={<Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setAddOpen(true)}>Add Employee</Button>}
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <IconSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            placeholder="Search name, email, code..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width: '100%', padding: '6px 10px 6px 30px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-1)', boxSizing: 'border-box' }}
          />
        </div>
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ width: 140 }}
        />
        <Select
          placeholder="All Departments"
          options={(depts || []).map((d: any) => ({ value: d.id, label: d.name }))}
          value={deptFilter}
          onChange={e => { setDeptFilter(e.target.value); setPage(1); }}
          style={{ width: 200 }}
        />
        <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
          {meta.total} employee{meta.total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)' }}>
              {['Employee', 'Code', 'Department', 'Designation', 'Type', 'Joining', 'Status', ''].map(h => (
                <th key={h} className="th-label" style={{ padding: '8px 16px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} style={{ padding: 16 }}><SkeletonTable rows={8} cols={8} /></td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 48, textAlign: 'center' }}>
                  <IconUser size={32} style={{ color: 'var(--text-3)', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>No employees found</div>
                </td>
              </tr>
            ) : rows.map((e: any) => (
              <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg-subtle)')}
                onMouseLeave={ev => (ev.currentTarget.style.background = '')}>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {e.photoUrl ? (
                      <img src={e.photoUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {e.firstName[0]}{e.lastName[0]}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{e.firstName} {e.lastName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{e.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-2)', fontFamily: 'monospace' }}>{e.employeeCode}</td>
                <td style={{ padding: '10px 16px', fontSize: 12.5 }}>{e.departmentName || '—'}</td>
                <td style={{ padding: '10px 16px', fontSize: 12.5 }}>{e.designationName || '—'}</td>
                <td style={{ padding: '10px 16px' }}>
                  <Badge variant={empTypeBadge(e.employmentType)} dot={false}>
                    {e.employmentType?.replace('_', ' ')}
                  </Badge>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                  {e.joiningDate ? new Date(e.joiningDate).toLocaleDateString('en-IN') : '—'}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <Badge variant={statusToBadge(e.status)}>{e.status}</Badge>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <Link to={`/employees/${e.id}`}>
                    <Button size="sm">View</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {meta.total > meta.limit && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Showing {(page - 1) * meta.limit + 1}–{Math.min(page * meta.limit, meta.total)} of {meta.total}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
              <Button size="sm" disabled={page * meta.limit >= meta.total} onClick={() => setPage(p => p + 1)}>Next →</Button>
            </div>
          </div>
        )}
      </div>

      <AddEmployeeModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
