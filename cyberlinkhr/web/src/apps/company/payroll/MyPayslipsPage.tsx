import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../../lib/api';
import { IconReceipt } from '@tabler/icons-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmt(v: string | null | undefined) {
  if (!v) return '₹0';
  return '₹' + parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function MyPayslipsPage() {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['my-payslips'],
    queryFn: () => api.get('/payroll/my-payslips').then(r => r.data.data),
  });

  const payslips: any[] = data || [];

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>My Payslips</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>Disbursed salary slips</p>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : payslips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)', background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
          No payslips yet. They appear here once payroll is disbursed.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {payslips.map((s) => (
            <Link key={s.id} to={`/payroll/payslip/${s.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '16px 20px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 40, height: 40, background: '#eff6ff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconReceipt size={18} color="#3b82f6" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>{MONTHS[s.month - 1]} {s.year}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      LOP: {parseFloat(s.lopDays || '0').toFixed(1)} days · Deductions: {fmt(s.totalDeductions)}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 20, color: '#22c55e' }}>{fmt(s.netSalary)}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Gross: {fmt(s.grossSalary)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
