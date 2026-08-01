import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconDownload, IconChartBar } from '@tabler/icons-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TABS = ['Headcount', 'Attendance', 'Leave', 'Payroll Trend', 'Salary Register', 'Attrition'];

function fmt(n: number) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
function pct(n: number) { return n.toFixed(1) + '%'; }

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click(); URL.revokeObjectURL(a.href);
}

const EMPTY = (
  <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
    No data to display
  </div>
);

// ─── Mini bar chart (pure SVG, no deps) ───────────────────────────────────────
function BarChart({ data, valueKey, labelKey, color = '#3b82f6', height = 140 }:
  { data: any[]; valueKey: string; labelKey: string; color?: string; height?: number }) {
  if (!data?.length) return EMPTY;
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  const barW = Math.max(20, Math.floor(540 / data.length) - 6);
  return (
    <svg viewBox={`0 0 560 ${height + 30}`} style={{ width: '100%', maxWidth: 600, display: 'block' }}>
      {data.map((d, i) => {
        const barH = Math.max(2, Math.round((d[valueKey] / max) * height));
        const x = i * (barW + 6) + 10;
        const y = height - barH + 4;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} opacity={0.85} />
            <text x={x + barW / 2} y={height + 20} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6}>{d[labelKey]}</text>
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.7}>{d[valueKey]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Dual bar chart (joiners vs leavers) ─────────────────────────────────────
function DualBarChart({ data, height = 140 }: { data: any[]; height: number }) {
  if (!data?.length) return EMPTY;
  const max = Math.max(...data.flatMap(d => [d.joiners, d.leavers]), 1);
  const bW = Math.max(14, Math.floor(520 / data.length / 2) - 2);
  return (
    <svg viewBox={`0 0 560 ${height + 40}`} style={{ width: '100%', maxWidth: 640, display: 'block' }}>
      {data.map((d, i) => {
        const groupW = (bW * 2) + 4;
        const x = i * (groupW + 6) + 10;
        const jH = Math.max(2, Math.round((d.joiners / max) * height));
        const lH = Math.max(2, Math.round((d.leavers / max) * height));
        return (
          <g key={i}>
            <rect x={x} y={height - jH + 4} width={bW} height={jH} rx={2} fill="#22c55e" opacity={0.85} />
            <rect x={x + bW + 4} y={height - lH + 4} width={bW} height={lH} rx={2} fill="#ef4444" opacity={0.85} />
            <text x={x + bW} y={height + 18} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>{d.label}</text>
          </g>
        );
      })}
      <g transform={`translate(10, ${height + 28})`}>
        <rect width={10} height={10} rx={2} fill="#22c55e" />
        <text x={14} y={9} fontSize={10} fill="currentColor" opacity={0.7}>Joiners</text>
        <rect x={70} width={10} height={10} rx={2} fill="#ef4444" />
        <text x={84} y={9} fontSize={10} fill="currentColor" opacity={0.7}>Leavers</text>
      </g>
    </svg>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 18px', minWidth: 120 }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--color-text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 14 }}>{title}</div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

// ─── Headcount Tab ────────────────────────────────────────────────────────────
function HeadcountTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['report-headcount'],
    queryFn: () => api.get('/reports/headcount').then(r => r.data.data),
  });

  if (isLoading) return <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>;
  if (!data) return null;

  function handleDownload() {
    downloadCSV('headcount.csv',
      ['Department', 'Count'],
      data.byDept.map((d: any) => [d.label, d.count])
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard label="Total Employees" value={data.total} />
        <StatCard label="Active" value={data.active} color="#22c55e" />
        <StatCard label="Inactive" value={data.inactive} color="#f59e0b" />
        <StatCard label="Separated" value={data.separated} color="#ef4444" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <SectionCard title="By Gender">
          {!data.byGender?.length ? EMPTY : data.byGender.map((g: any) => (
            <div key={g.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border)', fontSize: 14 }}>
              <span>{g.label}</span><strong>{g.count}</strong>
            </div>
          ))}
        </SectionCard>
        <SectionCard title="By Employment Type">
          {!data.byType?.length ? EMPTY : data.byType.map((t: any) => (
            <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border)', fontSize: 14 }}>
              <span>{t.label.replace('_', ' ')}</span><strong>{t.count}</strong>
            </div>
          ))}
        </SectionCard>
      </div>

      <SectionCard title="By Department">
        <button onClick={handleDownload} style={{ marginBottom: 14, padding: '6px 14px', border: '1px solid var(--color-border)', borderRadius: 7, background: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
          <IconDownload size={13} /> Export CSV
        </button>
        <BarChart data={data.byDept} valueKey="count" labelKey="label" />
      </SectionCard>
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────
function AttendanceTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report-attendance', month, year],
    queryFn: () => api.get(`/reports/attendance?month=${month}&year=${year}`).then(r => r.data.data),
  });

  function handleDownload() {
    if (!data) return;
    downloadCSV(`attendance_${year}_${month}.csv`,
      ['Department', 'Present', 'Absent', 'Late', 'Leave', 'Total', 'Attendance Rate %'],
      data.byDept.map((d: any) => [d.dept, d.present, d.absent, d.late, d.leave, d.total, d.attendanceRate])
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13 }}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ width: 80, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13 }} />
      </div>

      {isLoading ? <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div> : data && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <StatCard label="Attendance Rate" value={pct(data.attendanceRate)} color="#22c55e" />
            <StatCard label="Present" value={data.present} />
            <StatCard label="Absent" value={data.absent} color="#ef4444" />
            <StatCard label="Late" value={data.late} color="#f59e0b" />
            <StatCard label="On Leave" value={data.leave} color="#3b82f6" />
          </div>

          <SectionCard title="Attendance by Department">
            <button onClick={handleDownload} style={{ marginBottom: 14, padding: '6px 14px', border: '1px solid var(--color-border)', borderRadius: 7, background: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconDownload size={13} /> Export CSV
            </button>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Department', 'Present', 'Absent', 'Late', 'Leave', 'Rate'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byDept.map((d: any) => (
                    <tr key={d.dept} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '9px 10px', fontWeight: 500 }}>{d.dept}</td>
                      <td style={{ padding: '9px 10px' }}>{d.present}</td>
                      <td style={{ padding: '9px 10px', color: d.absent > 0 ? '#ef4444' : 'inherit' }}>{d.absent}</td>
                      <td style={{ padding: '9px 10px', color: d.late > 0 ? '#f59e0b' : 'inherit' }}>{d.late}</td>
                      <td style={{ padding: '9px 10px' }}>{d.leave}</td>
                      <td style={{ padding: '9px 10px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          background: d.attendanceRate >= 90 ? '#dcfce7' : d.attendanceRate >= 75 ? '#fef3c7' : '#fee2e2',
                          color: d.attendanceRate >= 90 ? '#15803d' : d.attendanceRate >= 75 ? '#92400e' : '#991b1b' }}>
                          {d.attendanceRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ─── Leave Tab ────────────────────────────────────────────────────────────────
function LeaveTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading } = useQuery({
    queryKey: ['report-leave', year],
    queryFn: () => api.get(`/reports/leave?year=${year}`).then(r => r.data.data),
  });

  function handleDownload() {
    if (!data) return;
    downloadCSV(`leave_${year}.csv`,
      ['Leave Type', 'Code', 'Approved Days', 'Pending Days', 'Rejected Days'],
      data.byType.map((t: any) => [t.name, t.code, t.approved, t.pending, t.rejected])
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 13 }}>Year:</span>
        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ width: 80, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13 }} />
      </div>

      {isLoading ? <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div> : data && (
        <>
          <SectionCard title="Leave Days Taken by Month (Approved)">
            <BarChart data={data.byMonth.map((m: any) => ({ ...m, label: MONTHS[m.month - 1] }))} valueKey="days" labelKey="label" color="#3b82f6" />
          </SectionCard>

          <SectionCard title="By Leave Type">
            <button onClick={handleDownload} style={{ marginBottom: 14, padding: '6px 14px', border: '1px solid var(--color-border)', borderRadius: 7, background: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconDownload size={13} /> Export CSV
            </button>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Leave Type', 'Code', 'Approved', 'Pending', 'Rejected'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byType.map((t: any) => (
                    <tr key={t.code} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '9px 10px', fontWeight: 500 }}>{t.name}</td>
                      <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: 12 }}>{t.code}</td>
                      <td style={{ padding: '9px 10px', color: '#22c55e', fontWeight: 600 }}>{t.approved.toFixed(1)}</td>
                      <td style={{ padding: '9px 10px', color: '#f59e0b' }}>{t.pending.toFixed(1)}</td>
                      <td style={{ padding: '9px 10px', color: '#ef4444' }}>{t.rejected.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ─── Payroll Trend Tab ────────────────────────────────────────────────────────
function PayrollTrendTab() {
  const [months, setMonths] = useState(6);
  const { data, isLoading } = useQuery({
    queryKey: ['report-payroll-trend', months],
    queryFn: () => api.get(`/reports/payroll-trend?months=${months}`).then(r => r.data.data),
  });

  function handleDownload() {
    if (!data) return;
    downloadCSV('payroll_trend.csv',
      ['Period', 'Status', 'Gross Payroll', 'Net Payroll', 'PF Cost', 'ESIC Cost', 'Employees'],
      data.trend.map((r: any) => [r.label, r.status, r.grossPayroll, r.netPayroll, r.pfCost, r.esicCost, r.employeeCount])
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 13 }}>Last</span>
        <select value={months} onChange={e => setMonths(Number(e.target.value))}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13 }}>
          {[3, 6, 12, 24].map(m => <option key={m} value={m}>{m} months</option>)}
        </select>
      </div>

      {isLoading ? <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div> : data && (
        <>
          <SectionCard title="Net Payroll (₹)">
            <BarChart data={data.trend.map((r: any) => ({ ...r, label: r.label.split(' ')[0] }))} valueKey="netPayroll" labelKey="label" color="#22c55e" />
          </SectionCard>

          <SectionCard title="Monthly Payroll Detail">
            <button onClick={handleDownload} style={{ marginBottom: 14, padding: '6px 14px', border: '1px solid var(--color-border)', borderRadius: 7, background: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconDownload size={13} /> Export CSV
            </button>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Period', 'Status', 'Gross', 'Net', 'PF Cost', 'ESIC Cost', 'Employees'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...data.trend].reverse().map((r: any) => (
                    <tr key={r.label} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '9px 10px', fontWeight: 600 }}>{r.label}</td>
                      <td style={{ padding: '9px 10px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                          background: r.status === 'DISBURSED' ? '#dcfce7' : r.status === 'LOCKED' ? '#fef3c7' : '#f3f4f6',
                          color: r.status === 'DISBURSED' ? '#15803d' : r.status === 'LOCKED' ? '#92400e' : '#6b7280' }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '9px 10px' }}>{fmt(r.grossPayroll)}</td>
                      <td style={{ padding: '9px 10px', fontWeight: 700, color: '#22c55e' }}>{fmt(r.netPayroll)}</td>
                      <td style={{ padding: '9px 10px' }}>{fmt(r.pfCost)}</td>
                      <td style={{ padding: '9px 10px' }}>{fmt(r.esicCost)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'center' }}>{r.employeeCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ─── Salary Register Tab ──────────────────────────────────────────────────────
function SalaryRegisterTab() {
  const { data: res, isLoading } = useQuery<any>({
    queryKey: ['report-salary-register'],
    queryFn: () => api.get('/reports/salary-register').then(r => r.data),
  });

  function handleDownload() {
    if (!res?.data) return;
    downloadCSV('salary_register.csv',
      ['Code', 'Name', 'Department', 'Type', 'Joining Date', 'Gross Salary', 'Basic', 'CTC', 'Structure', 'Effective From'],
      res.data.map((r: any) => [r.employeeCode, r.name, r.department, r.employmentType, r.joiningDate, r.grossSalary, r.basic, r.ctc, r.structureName, r.effectiveFrom])
    );
  }

  return (
    <div>
      {isLoading ? <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div> : res && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <StatCard label="Active Employees" value={res.summary.employeeCount} />
            <StatCard label="Total Monthly Gross" value={fmt(res.summary.totalGross)} color="#3b82f6" />
            <StatCard label="Total Monthly CTC" value={fmt(res.summary.totalCTC)} color="#6366f1" sub="incl. employer PF/ESIC" />
          </div>

          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleDownload} style={{ padding: '7px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconDownload size={14} /> Export Salary Register
            </button>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
                  {['Code', 'Name', 'Department', 'Type', 'Gross', 'Basic', 'CTC', 'Effective From'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {res.data.map((r: any) => (
                  <tr key={r.employeeCode} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{r.employeeCode}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 500 }}>{r.name}</td>
                    <td style={{ padding: '9px 12px', color: 'var(--color-text-secondary)' }}>{r.department}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12 }}>{r.employmentType?.replace('_', ' ')}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600 }}>{fmt(r.grossSalary)}</td>
                    <td style={{ padding: '9px 12px' }}>{fmt(r.basic)}</td>
                    <td style={{ padding: '9px 12px', color: '#6366f1', fontWeight: 600 }}>{fmt(r.ctc)}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--color-text-secondary)' }}>{r.effectiveFrom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Attrition Tab ────────────────────────────────────────────────────────────
function AttritionTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading } = useQuery({
    queryKey: ['report-attrition', year],
    queryFn: () => api.get(`/reports/attrition?year=${year}`).then(r => r.data.data),
  });

  function handleDownload() {
    if (!data) return;
    downloadCSV(`attrition_${year}.csv`,
      ['Month', 'Joiners', 'Leavers', 'Net'],
      data.monthly.map((m: any) => [m.label, m.joiners, m.leavers, m.joiners - m.leavers])
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 13 }}>Year:</span>
        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ width: 80, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13 }} />
      </div>

      {isLoading ? <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div> : data && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <StatCard label="Active Headcount" value={data.activeCount} color="#22c55e" />
            <StatCard label="Joiners" value={data.totalJoiners} color="#3b82f6" sub={`in ${year}`} />
            <StatCard label="Leavers" value={data.totalLeavers} color="#ef4444" sub={`in ${year}`} />
            <StatCard label="Attrition Rate" value={pct(data.attritionRate)} color={data.attritionRate > 15 ? '#ef4444' : data.attritionRate > 10 ? '#f59e0b' : '#22c55e'} />
          </div>

          <SectionCard title="Monthly Joiners vs Leavers">
            <DualBarChart data={data.monthly} height={140} />
            <button onClick={handleDownload} style={{ marginTop: 14, padding: '6px 14px', border: '1px solid var(--color-border)', borderRadius: 7, background: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconDownload size={13} /> Export CSV
            </button>
          </SectionCard>

          <SectionCard title="Monthly Breakdown">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Month', 'Joiners', 'Leavers', 'Net Change'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((m: any) => {
                    const net = m.joiners - m.leavers;
                    return (
                      <tr key={m.label} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '9px 10px', fontWeight: 500 }}>{m.label}</td>
                        <td style={{ padding: '9px 10px', color: m.joiners > 0 ? '#22c55e' : 'inherit' }}>{m.joiners}</td>
                        <td style={{ padding: '9px 10px', color: m.leavers > 0 ? '#ef4444' : 'inherit' }}>{m.leavers}</td>
                        <td style={{ padding: '9px 10px', color: net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'inherit', fontWeight: 600 }}>
                          {net > 0 ? '+' : ''}{net}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [tab, setTab] = useState(0);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <IconChartBar size={22} color="var(--color-primary)" />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Reports</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>HR analytics — headcount, attendance, payroll trends, attrition</p>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border)', marginBottom: 28, overflowX: 'auto' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            style={{ padding: '9px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === i ? 700 : 400,
              color: tab === i ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderBottom: tab === i ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -2, whiteSpace: 'nowrap' }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <HeadcountTab />}
      {tab === 1 && <AttendanceTab />}
      {tab === 2 && <LeaveTab />}
      {tab === 3 && <PayrollTrendTab />}
      {tab === 4 && <SalaryRegisterTab />}
      {tab === 5 && <AttritionTab />}
    </div>
  );
}
