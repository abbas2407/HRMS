import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconSearch, IconFilter } from '@tabler/icons-react';

function formatTime(d: string | Date | null): string {
  if (!d) return '--:--';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatHours(h: string | null): string {
  if (!h) return '--';
  const v = parseFloat(h);
  return `${Math.floor(v)}h ${Math.round((v % 1) * 60)}m`;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PRESENT:  { bg: '#dcfce7', color: '#166534' },
  LATE:     { bg: '#fef9c3', color: '#854d0e' },
  HALF_DAY: { bg: '#ffedd5', color: '#9a3412' },
  ABSENT:   { bg: '#fee2e2', color: '#991b1b' },
};

export default function AttendancePage() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'list', date, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ date });
      if (statusFilter) params.set('status', statusFilter);
      return api.get(`/attendance?${params}`).then(r => r.data.data);
    },
  });

  const rows: any[] = (data || []).filter((r: any) => {
    if (!search) return true;
    const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
    return fullName.includes(search.toLowerCase()) || r.employeeCode.toLowerCase().includes(search.toLowerCase());
  });

  // Summary counts
  const all = data || [];
  const counts = {
    PRESENT: all.filter((r: any) => r.status === 'PRESENT').length,
    LATE: all.filter((r: any) => r.status === 'LATE').length,
    HALF_DAY: all.filter((r: any) => r.status === 'HALF_DAY').length,
    ABSENT: all.filter((r: any) => r.status === 'ABSENT').length,
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Attendance Register</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)' }}>Daily attendance for all employees</p>
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 14, cursor: 'pointer' }} />
      </div>

      {/* Quick filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: '', label: `All (${all.length})` },
          { key: 'PRESENT', label: `Present (${counts.PRESENT})` },
          { key: 'LATE', label: `Late (${counts.LATE})` },
          { key: 'HALF_DAY', label: `Half Day (${counts.HALF_DAY})` },
          { key: 'ABSENT', label: `Absent (${counts.ABSENT})` },
        ].map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              borderColor: statusFilter === f.key ? 'var(--color-primary)' : 'var(--color-border)',
              background: statusFilter === f.key ? 'var(--color-primary)' : 'var(--color-surface)',
              color: statusFilter === f.key ? '#fff' : 'var(--color-text)',
            }}>
            {f.label}
          </button>
        ))}
        <div style={{ flex: 1, minWidth: 200, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <IconSearch size={14} style={{ position: 'absolute', left: 10, color: 'var(--color-text-secondary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or code..."
            style={{ paddingLeft: 30, padding: '6px 12px 6px 30px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, width: '100%' }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Employee', 'Department', 'Punch In', 'Punch Out', 'Hours', 'OT', 'Status', 'Source', 'Geo'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No records found</td></tr>
            ) : rows.map((row: any) => {
              const sc = row.status ? STATUS_COLORS[row.status] : null;
              return (
                <tr key={row.id || row.employeeId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.firstName} {row.lastName}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{row.employeeCode}</div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--color-text-secondary)' }}>{row.departmentName || '--'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>
                    {formatTime(row.punchIn)}
                    {row.isLate && <div style={{ fontSize: 11, color: '#f59e0b' }}>+{row.lateByMinutes}m late</div>}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{formatTime(row.punchOut)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{formatHours(row.workingHours)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{row.overtimeMinutes ? `${row.overtimeMinutes}m` : '--'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {sc && (
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, background: sc.bg, color: sc.color, fontWeight: 600, fontSize: 12 }}>
                        {row.status.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--color-text-secondary)' }}>{row.source}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>
                    {row.punchIn && row.geoDistanceMeters != null ? (
                      row.officeLocationName ? (
                        <span style={{ color: '#22c55e', fontWeight: 600 }}>
                          ✓ {row.officeLocationName}
                          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}> ({row.geoDistanceMeters}m)</span>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                          ⚠ {row.geoDistanceMeters}m away
                        </span>
                      )
                    ) : row.isGeoExempt ? (
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>Exempt</span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

