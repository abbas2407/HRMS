import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../../lib/api';
import { IconArrowLeft, IconSearch, IconUserOff, IconCheck } from '@tabler/icons-react';

const SEPARATION_CHECKLIST = [
  'Exit interview completed',
  'Access revoked (email, apps, VPN)',
  'Assets returned (laptop, ID card, phone)',
  'Full & Final settlement processed',
  'PF withdrawal / transfer initiated',
  'Relieving letter issued',
  'Experience letter issued',
  'Form 16 (if applicable) issued',
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
  color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box',
};

export default function SeparationPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'active' | 'separated'>('active');
  const [modal, setModal] = useState<any>(null);
  const [form, setForm] = useState({ separationDate: '', reason: '', noticePeriodServed: true, lastWorkingDay: '' });
  const [checklist, setChecklist] = useState<boolean[]>(SEPARATION_CHECKLIST.map(() => false));
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['separation-employees', tab],
    queryFn: () => api.get(`/employees?status=${tab === 'active' ? 'ACTIVE' : 'SEPARATED'}`).then(r => r.data.data),
  });

  const separateMutation = useMutation({
    mutationFn: () => api.put(`/employees/${modal.id}/status`, {
      status: 'SEPARATED',
      separationDate: form.separationDate || form.lastWorkingDay,
      reason: form.reason,
    }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['separation-employees'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setModal(null);
      setForm({ separationDate: '', reason: '', noticePeriodServed: true, lastWorkingDay: '' });
      setChecklist(SEPARATION_CHECKLIST.map(() => false));
      setError('');
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed to process separation'),
  });

  const filtered = (data || []).filter((e: any) =>
    !search || `${e.firstName} ${e.lastName} ${e.employeeCode}`.toLowerCase().includes(search.toLowerCase())
  );

  const checklistDone = checklist.every(Boolean);

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <IconUserOff size={22} color="#ef4444" />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Separation</h1>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>Offboarding workflow — resignations, terminations & exits</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border)', marginBottom: 20 }}>
        {(['active', 'separated'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '9px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 700 : 400,
              color: tab === t ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent', marginBottom: -2, textTransform: 'capitalize' }}>
            {t === 'active' ? 'Active Employees' : 'Separated Employees'}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <IconSearch size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
        <input placeholder="Search by name or code..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 34 }} />
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
                {['Code', 'Employee', 'Department', 'Joining Date', tab === 'active' ? 'Employment Type' : 'Separation Date', 'Action'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No employees found.</td></tr>
              ) : filtered.map((e: any) => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12 }}>{e.employeeCode}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <Link to={`/employees/${e.id}`} style={{ textDecoration: 'none', color: 'var(--color-primary)', fontWeight: 600 }}>
                      {e.firstName} {e.lastName}
                    </Link>
                  </td>
                  <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)' }}>{e.departmentName || '—'}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)' }}>{e.joiningDate}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)' }}>
                    {tab === 'active' ? (e.employmentType || '—').replace('_', ' ') : (e.separationDate || '—')}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {tab === 'active' ? (
                      <button onClick={() => { setModal(e); setForm({ separationDate: '', reason: '', noticePeriodServed: true, lastWorkingDay: '' }); setChecklist(SEPARATION_CHECKLIST.map(() => false)); setError(''); }}
                        style={{ padding: '5px 12px', border: '1px solid #fecaca', borderRadius: 7, background: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 600, fontSize: 12 }}>
                        Initiate Exit
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>SEPARATED</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Separation modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Initiate Exit — {modal.firstName} {modal.lastName}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{modal.employeeCode} · Joined {modal.joiningDate}</div>
              </div>
              <button onClick={() => setModal(null)} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-text-secondary)' }}>×</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Exit details */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Exit Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Last Working Day *</label>
                    <input type="date" style={inputStyle} value={form.lastWorkingDay} onChange={e => setForm(f => ({ ...f, lastWorkingDay: e.target.value, separationDate: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={form.noticePeriodServed} onChange={e => setForm(f => ({ ...f, noticePeriodServed: e.target.checked }))} />
                      Notice period served
                    </label>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Exit Reason</label>
                  <select style={inputStyle} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
                    <option value="">Select reason...</option>
                    <option value="Resignation">Resignation</option>
                    <option value="Termination">Termination</option>
                    <option value="Contract End">Contract End</option>
                    <option value="Retirement">Retirement</option>
                    <option value="Mutual Separation">Mutual Separation</option>
                    <option value="Absconding">Absconding</option>
                  </select>
                </div>
              </div>

              {/* Offboarding checklist */}
              <div style={{ background: 'var(--color-background)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Offboarding Checklist</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {SEPARATION_CHECKLIST.map((item, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                      <div onClick={() => setChecklist(c => c.map((v, j) => j === i ? !v : v))}
                        style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${checklist[i] ? '#22c55e' : 'var(--color-border)'}`,
                          background: checklist[i] ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
                        {checklist[i] && <IconCheck size={12} color="#fff" strokeWidth={3} />}
                      </div>
                      <span style={{ color: checklist[i] ? 'var(--color-text-secondary)' : 'var(--color-text)', textDecoration: checklist[i] ? 'line-through' : 'none' }}>{item}</span>
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: checklistDone ? '#22c55e' : 'var(--color-text-secondary)' }}>
                  {checklist.filter(Boolean).length} / {SEPARATION_CHECKLIST.length} items completed
                </div>
              </div>

              {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setModal(null)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
                <button onClick={() => separateMutation.mutate()}
                  disabled={separateMutation.isPending || !form.lastWorkingDay || !form.reason}
                  style={{ padding: '9px 18px', borderRadius: 9, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, opacity: (!form.lastWorkingDay || !form.reason) ? 0.5 : 1 }}>
                  {separateMutation.isPending ? 'Processing...' : 'Confirm Separation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
