import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../../lib/api';
import { IconArrowLeft, IconReceipt } from '@tabler/icons-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmt(v: string | null | undefined) {
  if (!v) return '—';
  return '₹' + parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    DRAFT: { bg: '#f3f4f6', color: '#6b7280' },
    LOCKED: { bg: '#fef3c7', color: '#92400e' },
    DISBURSED: { bg: '#dcfce7', color: '#15803d' },
  };
  const s = map[status] || map.DRAFT;
  return <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color }}>{status}</span>;
}

export default function PayrollRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: run, isLoading: runLoading } = useQuery({
    queryKey: ['payroll-run', id],
    queryFn: () => api.get(`/payroll/runs/${id}`).then(r => r.data.data),
    enabled: !!id,
  });

  const { data: slipsData, isLoading: slipsLoading } = useQuery<any[]>({
    queryKey: ['payroll-run-payslips', id],
    queryFn: () => api.get(`/payroll/runs/${id}/payslips`).then(r => r.data.data),
    enabled: !!id,
  });

  const slips: any[] = slipsData || [];

  if (runLoading) return <div style={{ padding: 24, color: 'var(--color-text-secondary)' }}>Loading...</div>;
  if (!run) return <div style={{ padding: 24, color: '#ef4444' }}>Payroll run not found.</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <button onClick={() => navigate('/payroll')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'none', cursor: 'pointer', marginBottom: 20, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        <IconArrowLeft size={14} /> Back to Runs
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            {MONTHS[run.month - 1]} {run.year} {statusBadge(run.status)}
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>{slips.length} payslips generated</p>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Gross Payroll', value: fmt(run.totalGross), color: 'var(--color-text)' },
          { label: 'Loss of Pay', value: fmt(run.totalLop), color: '#ef4444' },
          { label: 'PF (Employee)', value: fmt(run.totalPfEmployee), color: '#6366f1' },
          { label: 'PF (Employer)', value: fmt(run.totalPfEmployer), color: '#6366f1' },
          { label: 'ESIC (EE)', value: fmt(run.totalEsicEmployee), color: '#8b5cf6' },
          { label: 'ESIC (ER)', value: fmt(run.totalEsicEmployer), color: '#8b5cf6' },
          { label: 'Prof. Tax', value: fmt(run.totalPt), color: '#0ea5e9' },
          { label: 'TDS', value: fmt(run.totalTds), color: '#f59e0b' },
          { label: 'Net Payable', value: fmt(run.totalNet), color: '#22c55e' },
        ].map((c) => (
          <div key={c.label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Payslips table */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 15 }}>Employee Payslips</div>
        {slipsLoading ? (
          <div style={{ padding: 24, color: 'var(--color-text-secondary)' }}>Loading...</div>
        ) : slips.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No payslips in this run.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
                  {['Code', 'Employee', 'Dept', 'WD', 'Present', 'LOP days', 'Gross', 'LOP Amt', 'PF', 'ESIC', 'PT', 'TDS', 'Net', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slips.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{s.employeeCode}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{s.firstName} {s.lastName}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{s.departmentName || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{s.workingDays}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{parseFloat(s.presentDays || '0').toFixed(1)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: parseFloat(s.lopDays || '0') > 0 ? '#ef4444' : 'inherit' }}>{parseFloat(s.lopDays || '0').toFixed(1)}</td>
                    <td style={{ padding: '10px 12px' }}>{fmt(s.grossSalary)}</td>
                    <td style={{ padding: '10px 12px', color: '#ef4444' }}>{fmt(s.lopAmount)}</td>
                    <td style={{ padding: '10px 12px' }}>{fmt(s.pfEmployee)}</td>
                    <td style={{ padding: '10px 12px' }}>{fmt(s.esicEmployee)}</td>
                    <td style={{ padding: '10px 12px' }}>{fmt(s.professionalTax)}</td>
                    <td style={{ padding: '10px 12px' }}>{fmt(s.tds)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#22c55e' }}>{fmt(s.netSalary)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <Link to={`/payroll/payslip/${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none' }}>
                        <IconReceipt size={13} /> Slip
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
