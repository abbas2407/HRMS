import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../lib/api';
import { IconArrowLeft, IconPrinter } from '@tabler/icons-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <tr>
      <td style={{ padding: '7px 12px', color: 'var(--color-text-secondary)', fontSize: 13 }}>{label}</td>
      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: bold ? 700 : 400, color: color || 'var(--color-text)', fontSize: 13 }}>{value}</td>
    </tr>
  );
}

function fmt(v: string | number | null | undefined) {
  if (v === null || v === undefined) return '₹0';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function PayslipPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: slip, isLoading } = useQuery({
    queryKey: ['payslip', id],
    queryFn: () => api.get(`/payroll/payslips/${id}`).then(r => r.data.data),
    enabled: !!id,
  });

  if (isLoading) return <div style={{ padding: 24, color: 'var(--color-text-secondary)' }}>Loading...</div>;
  if (!slip) return <div style={{ padding: 24, color: '#ef4444' }}>Payslip not found.</div>;

  const otherEarnings: any[] = Array.isArray(slip.otherEarnings) ? slip.otherEarnings : [];
  const otherDeductions: any[] = Array.isArray(slip.otherDeductions) ? slip.otherDeductions : [];

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <IconArrowLeft size={14} /> Back
        </button>
        <button onClick={() => window.open(`${api.defaults.baseURL}/framework/print/payroll/${id}`, '_blank')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          <IconPrinter size={14} /> Print
        </button>
      </div>

      <div id="payslip-print" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'var(--color-primary)', padding: '20px 28px', color: 'white' }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>CyberlinkHR</div>
          <div style={{ fontSize: 14, opacity: 0.85, marginTop: 2 }}>Payslip for {MONTHS[slip.month - 1]} {slip.year}</div>
        </div>

        {/* Employee info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: '1px solid var(--color-border)', padding: '18px 28px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{slip.firstName} {slip.lastName}</div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 2 }}>{slip.employeeCode}</div>
            {slip.departmentName && <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{slip.departmentName}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Working Days: <strong style={{ color: 'var(--color-text)' }}>{slip.workingDays}</strong>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Days Present: <strong style={{ color: 'var(--color-text)' }}>{parseFloat(slip.presentDays || '0').toFixed(1)}</strong>
            </div>
            {parseFloat(slip.lopDays || '0') > 0 && (
              <div style={{ fontSize: 13, color: '#ef4444' }}>
                LOP Days: <strong>{parseFloat(slip.lopDays).toFixed(1)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Earnings & Deductions side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          {/* Earnings */}
          <div style={{ borderRight: '1px solid var(--color-border)' }}>
            <div style={{ padding: '12px 20px', background: 'var(--color-background)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
              Earnings
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <Row label="Basic" value={fmt(slip.basic)} />
                <Row label="HRA" value={fmt(slip.hra)} />
                <Row label="Special Allowance" value={fmt(slip.specialAllowance)} />
                {otherEarnings.map((e: any) => <Row key={e.name} label={e.name} value={fmt(e.amount)} />)}
                {parseFloat(slip.lopAmount || '0') > 0 && (
                  <Row label="Loss of Pay" value={`-${fmt(slip.lopAmount)}`} color="#ef4444" />
                )}
              </tbody>
            </table>
            <div style={{ borderTop: '2px solid var(--color-border)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span style={{ fontSize: 13 }}>Earned Gross</span>
              <span style={{ color: '#22c55e', fontSize: 14 }}>{fmt(slip.earnedGross)}</span>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <div style={{ padding: '12px 20px', background: 'var(--color-background)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
              Deductions
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <Row label="PF (Employee)" value={fmt(slip.pfEmployee)} />
                <Row label="ESIC (Employee)" value={fmt(slip.esicEmployee)} />
                <Row label="Professional Tax" value={fmt(slip.professionalTax)} />
                <Row label="TDS (Income Tax)" value={fmt(slip.tds)} />
                {otherDeductions.map((d: any) => <Row key={d.name} label={d.name} value={fmt(d.amount)} />)}
              </tbody>
            </table>
            <div style={{ borderTop: '2px solid var(--color-border)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span style={{ fontSize: 13 }}>Total Deductions</span>
              <span style={{ color: '#ef4444', fontSize: 14 }}>{fmt(slip.totalDeductions)}</span>
            </div>
          </div>
        </div>

        {/* Net pay footer */}
        <div style={{ background: 'var(--color-primary)', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Net Pay for {MONTHS[slip.month - 1]} {slip.year}</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{fmt(slip.netSalary)}</div>
        </div>

        {/* Employer contributions note */}
        <div style={{ padding: '12px 28px', borderTop: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Employer contributions (not deducted from salary) — PF: {fmt(slip.pfEmployer)} · ESIC: {fmt(slip.esicEmployer)}
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #payslip-print, #payslip-print * { visibility: visible; }
          #payslip-print { position: absolute; left: 0; top: 0; width: 100%; border: none !important; border-radius: 0 !important; }
        }
      `}</style>
    </div>
  );
}
