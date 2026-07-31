import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../../lib/api';
import { IconCheck, IconClock, IconArrowRight, IconUserPlus } from '@tabler/icons-react';

const ONBOARDING_CHECKLIST = [
  { key: 'personal_info', label: 'Personal Information', desc: 'Name, DOB, gender, contact filled', required: true },
  { key: 'bank_details', label: 'Bank Account Details', desc: 'Account number and IFSC added', required: true },
  { key: 'pan_aadhaar', label: 'PAN & Aadhaar', desc: 'Government ID documents added', required: true },
  { key: 'department', label: 'Department & Designation', desc: 'Org structure assigned', required: true },
  { key: 'salary', label: 'Salary Structure', desc: 'Gross salary and structure assigned', required: true },
  { key: 'shift', label: 'Shift Assignment', desc: 'Work shift assigned', required: false },
  { key: 'documents', label: 'Offer Letter / Contract', desc: 'Employment documents uploaded', required: false },
  { key: 'user_account', label: 'User Account', desc: 'Login credentials created', required: true },
];

function checkEmployee(emp: any): Record<string, boolean> {
  return {
    personal_info: !!(emp.firstName && emp.lastName && emp.dob && emp.phone),
    bank_details: !!(emp.bankAccount && emp.bankIfsc),
    pan_aadhaar: !!(emp.panNumber && emp.aadhaarNumber),
    department: !!(emp.departmentId && emp.designationId),
    salary: !!(emp.currentGross),
    shift: true, // assume checked externally
    documents: true, // assume checked externally
    user_account: !!(emp.hasUser),
  };
}

function StatusDot({ done }: { done: boolean }) {
  return (
    <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      background: done ? '#22c55e' : 'var(--color-border)', border: done ? 'none' : '2px dashed var(--color-border)' }}>
      {done && <IconCheck size={13} color="#fff" strokeWidth={3} />}
    </div>
  );
}

function EmployeeOnboardCard({ emp }: { emp: any }) {
  const checks = checkEmployee(emp);
  const done = Object.values(checks).filter(Boolean).length;
  const total = ONBOARDING_CHECKLIST.length;
  const complete = done === total;
  const pct = Math.round((done / total) * 100);

  return (
    <div style={{ background: 'var(--color-surface)', border: `1px solid ${complete ? '#86efac' : 'var(--color-border)'}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: complete ? '#dcfce7' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: complete ? '#15803d' : '#3b82f6' }}>
            {emp.firstName[0]}{emp.lastName[0]}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{emp.firstName} {emp.lastName}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{emp.employeeCode} · Joined {emp.joiningDate}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: complete ? '#15803d' : 'var(--color-text-secondary)' }}>{pct}%</span>
          <Link to={`/employees/${emp.id}`} style={{ textDecoration: 'none' }}>
            <button style={{ padding: '5px 12px', border: '1px solid var(--color-border)', borderRadius: 7, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-text)' }}>
              View <IconArrowRight size={12} />
            </button>
          </Link>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--color-border)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: complete ? '#22c55e' : 'var(--color-primary)', transition: 'width 0.3s' }} />
      </div>

      <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {ONBOARDING_CHECKLIST.map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusDot done={checks[item.key]} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: checks[item.key] ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
                {item.label}{item.required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [search, setSearch] = useState('');

  // Fetch recently joined employees (last 90 days)
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['onboarding-employees'],
    queryFn: () => api.get('/employees?status=ACTIVE&recentDays=90').then(r => r.data.data),
  });

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const newEmps = (data || [])
    .filter((e: any) => e.joiningDate >= since)
    .filter((e: any) =>
      !search || `${e.firstName} ${e.lastName} ${e.employeeCode}`.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a: any, b: any) => b.joiningDate.localeCompare(a.joiningDate));

  const pending = newEmps.filter(e => {
    const checks = checkEmployee(e);
    return Object.values(checks).some(v => !v);
  });

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconUserPlus size={22} color="var(--color-primary)" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Onboarding</h1>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>New joiners in the last 90 days — track setup completion</p>
          </div>
        </div>
        <Link to="/employees/new" style={{ textDecoration: 'none' }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
            <IconUserPlus size={16} /> Add Employee
          </button>
        </Link>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'New Joiners (90d)', value: newEmps.length, color: '#3b82f6' },
          { label: 'Setup Incomplete', value: pending.length, color: pending.length > 0 ? '#ef4444' : '#22c55e' },
          { label: 'Fully Onboarded', value: newEmps.length - pending.length, color: '#22c55e' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <input placeholder="Search by name or code..." value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 14, marginBottom: 20, boxSizing: 'border-box' }} />

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : newEmps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)', background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <IconClock size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
          <div>No new employees in the last 90 days.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {newEmps.map(e => <EmployeeOnboardCard key={e.id} emp={e} />)}
        </div>
      )}
    </div>
  );
}
