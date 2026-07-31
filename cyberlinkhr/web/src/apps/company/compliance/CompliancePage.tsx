import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconDownload, IconShield } from '@tabler/icons-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const QUARTERS = ['Q1 (Apr–Jun)','Q2 (Jul–Sep)','Q3 (Oct–Dec)','Q4 (Jan–Mar)'];
const TABS = ['PF / ECR', 'ESIC', 'Prof. Tax', 'Form 24Q', 'Bank NEFT', 'Form 16'];

function fmt(n: number) { return '₹' + Math.round(n).toLocaleString('en-IN'); }

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Shared period picker ──────────────────────────────────────────────────────
function MonthPicker({ month, year, onChange }: { month: number; year: number; onChange: (m: number, y: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <select value={month} onChange={e => onChange(Number(e.target.value), year)}
        style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13 }}>
        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>
      <input type="number" value={year} onChange={e => onChange(month, Number(e.target.value))}
        style={{ width: 80, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13 }} />
    </div>
  );
}

// ─── PF / ECR Tab ─────────────────────────────────────────────────────────────
function PFTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['compliance-pf', month, year],
    queryFn: () => api.get(`/compliance/pf?month=${month}&year=${year}`).then(r => r.data),
    enabled: false,
  });

  function handleDownload() {
    if (!data?.data) return;
    downloadCSV(
      `PF_ECR_${year}_${String(month).padStart(2,'0')}.csv`,
      ['Employee Code','Name','UAN','DOB','Gross Wages','EPF Wages','EE Contribution','ER Contribution','NCP Days'],
      data.data.map((r: any) => [r.employeeCode, r.name, r.uan, r.dob, r.grossWages, r.epfWages, r.eeContribution, r.erContribution, r.ncpDays])
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
        <button onClick={() => refetch()} style={btnStyle('primary')}>Fetch</button>
        {data?.data && <button onClick={handleDownload} style={btnStyle('outline')}><IconDownload size={14} /> Download ECR CSV</button>}
      </div>

      {isLoading && <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>}
      {(error as any) && <div style={{ color: '#ef4444', fontSize: 13 }}>{(error as any)?.response?.data?.error || 'Error'}</div>}

      {data && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'EE Total', value: fmt(data.summary.totalEE), color: '#3b82f6' },
              { label: 'ER Total', value: fmt(data.summary.totalER), color: '#6366f1' },
              { label: 'Employees', value: data.summary.employeeCount, color: 'var(--color-text)' },
            ].map(c => (
              <div key={c.label} style={statCard}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>
          <ComplianceTable
            headers={['Code','Name','UAN','Gross Wages','EPF Wages','EE Cont.','ER Cont.','NCP Days']}
            rows={data.data.map((r: any) => [r.employeeCode, r.name, r.uan || '—', fmt(r.grossWages), fmt(r.epfWages), fmt(r.eeContribution), fmt(r.erContribution), r.ncpDays])}
          />
        </>
      )}
    </div>
  );
}

// ─── ESIC Tab ─────────────────────────────────────────────────────────────────
function ESICTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['compliance-esic', month, year],
    queryFn: () => api.get(`/compliance/esic?month=${month}&year=${year}`).then(r => r.data),
    enabled: false,
  });

  function handleDownload() {
    if (!data?.data) return;
    downloadCSV(
      `ESIC_${year}_${String(month).padStart(2,'0')}.csv`,
      ['Employee Code','Name','IP Number','Gross Wages','EE (0.75%)','ER (3.25%)','Total'],
      data.data.map((r: any) => [r.employeeCode, r.name, r.ipNumber, r.grossWages, r.eeContribution, r.erContribution, r.totalContribution])
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
        <button onClick={() => refetch()} style={btnStyle('primary')}>Fetch</button>
        {data?.data && <button onClick={handleDownload} style={btnStyle('outline')}><IconDownload size={14} /> Download CSV</button>}
      </div>

      {isLoading && <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>}
      {(error as any) && <div style={{ color: '#ef4444', fontSize: 13 }}>{(error as any)?.response?.data?.error || 'Error'}</div>}

      {data && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'EE Total', value: fmt(data.summary.totalEE) },
              { label: 'ER Total', value: fmt(data.summary.totalER) },
              { label: 'Eligible Employees (≤₹21k)', value: data.summary.eligibleCount },
            ].map(c => (
              <div key={c.label} style={statCard}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{c.value}</div>
              </div>
            ))}
          </div>
          <ComplianceTable
            headers={['Code','Name','IP Number','Gross Wages','EE (0.75%)','ER (3.25%)','Total']}
            rows={data.data.map((r: any) => [r.employeeCode, r.name, r.ipNumber || '—', fmt(r.grossWages), fmt(r.eeContribution), fmt(r.erContribution), fmt(r.totalContribution)])}
          />
        </>
      )}
    </div>
  );
}

// ─── PT Tab ───────────────────────────────────────────────────────────────────
function PTTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['compliance-pt', month, year],
    queryFn: () => api.get(`/compliance/pt?month=${month}&year=${year}`).then(r => r.data),
    enabled: false,
  });

  function handleDownload() {
    if (!data?.data) return;
    downloadCSV(
      `PT_${year}_${String(month).padStart(2,'0')}.csv`,
      ['Employee Code','Name','State','Gross','Professional Tax'],
      data.data.map((r: any) => [r.employeeCode, r.name, r.state, r.earnedGross, r.professionalTax])
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
        <button onClick={() => refetch()} style={btnStyle('primary')}>Fetch</button>
        {data?.data && <button onClick={handleDownload} style={btnStyle('outline')}><IconDownload size={14} /> Download CSV</button>}
      </div>

      {isLoading && <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>}
      {(error as any) && <div style={{ color: '#ef4444', fontSize: 13 }}>{(error as any)?.response?.data?.error || 'Error'}</div>}

      {data && (
        <>
          <div style={statCard}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Total PT</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(data.totalPT)}</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <ComplianceTable
              headers={['Code','Name','State','Gross','PT Amount']}
              rows={(data.data || []).map((r: any) => [r.employeeCode, r.name, r.state, fmt(r.earnedGross), fmt(r.professionalTax)])}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Form 24Q Tab ─────────────────────────────────────────────────────────────
function Form24QTab() {
  const now = new Date();
  // Determine current FY start
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [quarter, setQuarter] = useState(1);
  const [fy, setFY] = useState(fyStart);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['compliance-24q', quarter, fy],
    queryFn: () => api.get(`/compliance/form24q?quarter=${quarter}&year=${fy}`).then(r => r.data),
    enabled: false,
  });

  function handleDownload() {
    if (!data?.data) return;
    downloadCSV(
      `Form24Q_Q${quarter}_FY${fy}.csv`,
      ['Employee Code','Name','PAN','Total Salary','Total TDS','Months Included'],
      data.data.map((r: any) => [r.employeeCode, r.name, r.pan, Math.round(r.totalSalary), Math.round(r.totalTDS), r.months?.join(',') || ''])
    );
  }

  return (
    <div>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Quarterly TDS return data. Only DISBURSED payroll runs are included.
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={quarter} onChange={e => setQuarter(Number(e.target.value))}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13 }}>
          {QUARTERS.map((q, i) => <option key={i} value={i + 1}>{q}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <span>FY</span>
          <input type="number" value={fy} onChange={e => setFY(Number(e.target.value))}
            style={{ width: 80, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13 }} />
          <span style={{ color: 'var(--color-text-secondary)' }}>– {fy + 1}</span>
        </div>
        <button onClick={() => refetch()} style={btnStyle('primary')}>Fetch</button>
        {data?.data?.length > 0 && <button onClick={handleDownload} style={btnStyle('outline')}><IconDownload size={14} /> Download CSV</button>}
      </div>

      {isLoading && <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>}
      {(error as any) && <div style={{ color: '#ef4444', fontSize: 13 }}>{(error as any)?.response?.data?.error || 'Error'}</div>}

      {data && (
        <>
          {data.summary && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'Quarter', value: data.summary.quarterLabel },
                { label: 'Total Salary', value: fmt(data.summary.totalSalary) },
                { label: 'Total TDS', value: fmt(data.summary.totalTDS) },
                { label: 'Employees', value: data.summary.employeeCount },
              ].map(c => (
                <div key={c.label} style={statCard}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{c.value}</div>
                </div>
              ))}
            </div>
          )}
          <ComplianceTable
            headers={['Code','Name','PAN','Total Salary','Total TDS']}
            rows={(data.data || []).map((r: any) => [r.employeeCode, r.name, r.pan, fmt(r.totalSalary), fmt(r.totalTDS)])}
          />
        </>
      )}
    </div>
  );
}

// ─── Bank NEFT Tab ────────────────────────────────────────────────────────────
function NEFTTab({ runs }: { runs: any[] }) {
  const [runId, setRunId] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['compliance-neft', runId],
    queryFn: () => api.get(`/compliance/neft?runId=${runId}`).then(r => r.data),
    enabled: false,
  });

  function handleDownload() {
    if (!data?.data) return;
    downloadCSV(
      `NEFT_${data.year}_${String(data.month).padStart(2,'0')}.csv`,
      ['Employee Code','Name','Bank Account','IFSC','Bank','Net Salary'],
      data.data.map((r: any) => [r.employeeCode, r.name, r.bankAccount, r.bankIfsc, r.bankName, r.netSalary])
    );
  }

  const eligibleRuns = runs.filter(r => r.status !== 'DRAFT');

  return (
    <div>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Generate salary transfer file for bank NEFT/RTGS. Available for LOCKED and DISBURSED runs.
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={runId} onChange={e => setRunId(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13, minWidth: 200 }}>
          <option value="">Select payroll run...</option>
          {eligibleRuns.map((r: any) => (
            <option key={r.id} value={r.id}>{MONTHS[r.month - 1]} {r.year} — {r.status}</option>
          ))}
        </select>
        <button onClick={() => refetch()} disabled={!runId} style={btnStyle('primary')}>Fetch</button>
        {data?.data && <button onClick={handleDownload} style={btnStyle('outline')}><IconDownload size={14} /> Download NEFT CSV</button>}
      </div>

      {isLoading && <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>}
      {(error as any) && <div style={{ color: '#ef4444', fontSize: 13 }}>{(error as any)?.response?.data?.error || 'Error'}</div>}

      {data && (
        <>
          <div style={{ ...statCard, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Total Transfer Amount</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{fmt(data.totalAmount)}</div>
          </div>
          <ComplianceTable
            headers={['Code','Name','Bank Account','IFSC','Bank','Net Salary']}
            rows={(data.data || []).map((r: any) => [r.employeeCode, r.name, r.bankAccount || '—', r.bankIfsc || '—', r.bankName || '—', fmt(r.netSalary)])}
          />
        </>
      )}
    </div>
  );
}

// ─── Form 16 Tab ──────────────────────────────────────────────────────────────
function Form16Tab() {
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [fy, setFY] = useState(fyStart);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['compliance-form16', fy],
    queryFn: () => api.get(`/compliance/form16?fy=${fy}`).then(r => r.data),
    enabled: false,
  });

  function handleDownload() {
    if (!data?.data) return;
    downloadCSV(
      `Form16_FY${fy}.csv`,
      ['Employee Code','Name','PAN','Total Gross','Taxable Income','Total TDS','PF Contribution','Months Paid'],
      data.data.map((r: any) => [r.employeeCode, r.name, r.pan, Math.round(r.totalGross), Math.round(r.taxableIncome), Math.round(r.totalTDS), Math.round(r.totalPFEmployee), r.months])
    );
  }

  return (
    <div>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Annual TDS certificate (Part A + Part B summary). Includes all DISBURSED runs in the financial year.
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <span>FY</span>
          <input type="number" value={fy} onChange={e => setFY(Number(e.target.value))}
            style={{ width: 80, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 13 }} />
          <span style={{ color: 'var(--color-text-secondary)' }}>– {fy + 1}</span>
        </div>
        <button onClick={() => refetch()} style={btnStyle('primary')}>Fetch</button>
        {data?.data?.length > 0 && <button onClick={handleDownload} style={btnStyle('outline')}><IconDownload size={14} /> Download CSV</button>}
      </div>

      {isLoading && <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>}
      {(error as any) && <div style={{ color: '#ef4444', fontSize: 13 }}>{(error as any)?.response?.data?.error || 'Error'}</div>}

      {data && (
        <>
          {data.employeeCount > 0 && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'FY', value: data.fyLabel },
                { label: 'Total Gross', value: fmt(data.data.reduce((s: number, r: any) => s + r.totalGross, 0)) },
                { label: 'Total TDS', value: fmt(data.data.reduce((s: number, r: any) => s + r.totalTDS, 0)) },
                { label: 'Employees', value: data.employeeCount },
              ].map(c => (
                <div key={c.label} style={statCard}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{c.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{c.value}</div>
                </div>
              ))}
            </div>
          )}
          <ComplianceTable
            headers={['Code','Name','PAN','Total Gross','Taxable Income','Total TDS','PF','Months']}
            rows={(data.data || []).map((r: any) => [r.employeeCode, r.name, r.pan, fmt(r.totalGross), fmt(r.taxableIncome), fmt(r.totalTDS), fmt(r.totalPFEmployee), r.months])}
          />
        </>
      )}
    </div>
  );
}

// ─── Shared table component ────────────────────────────────────────────────────
function ComplianceTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-secondary)', fontSize: 13 }}>No data.</div>;
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
            {headers.map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const statCard: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '12px 16px',
  display: 'inline-block',
};

function btnStyle(variant: 'primary' | 'outline'): React.CSSProperties {
  return variant === 'primary'
    ? { padding: '7px 18px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }
    : { padding: '7px 18px', borderRadius: 8, background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer', color: 'var(--color-text)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 };
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CompliancePage() {
  const [tab, setTab] = useState(0);

  const { data: runsData } = useQuery<any[]>({
    queryKey: ['compliance-runs'],
    queryFn: () => api.get('/compliance/runs').then(r => r.data.data),
  });

  const runs: any[] = runsData || [];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <IconShield size={22} color="var(--color-primary)" />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Compliance</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>Statutory reports — PF, ESIC, PT, TDS, Form 16, Bank NEFT</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border)', marginBottom: 28 }}>
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

      {/* Tab content */}
      {tab === 0 && <PFTab />}
      {tab === 1 && <ESICTab />}
      {tab === 2 && <PTTab />}
      {tab === 3 && <Form24QTab />}
      {tab === 4 && <NEFTTab runs={runs} />}
      {tab === 5 && <Form16Tab />}
    </div>
  );
}
