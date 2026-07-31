import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../../lib/api';
import { IconPlus, IconLock, IconCheck, IconTrash, IconEye } from '@tabler/icons-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    DRAFT: { bg: '#f3f4f6', color: '#6b7280' },
    LOCKED: { bg: '#fef3c7', color: '#92400e' },
    DISBURSED: { bg: '#dcfce7', color: '#15803d' },
  };
  const style = map[status] || map.DRAFT;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: style.bg, color: style.color }}>
      {status}
    </span>
  );
}

function fmt(v: string | null | undefined) {
  if (!v) return '—';
  return '₹' + parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function PayrollRunsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [createModal, setCreateModal] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [createError, setCreateError] = useState('');

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs').then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/payroll/runs', form).then(r => r.data),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); setCreateModal(false); setCreateError(''); navigate(`/payroll/${res.data.id}`); },
    onError: (e: any) => setCreateError(e?.response?.data?.error || 'Failed to create'),
  });

  const lockMutation = useMutation({
    mutationFn: (id: string) => api.put(`/payroll/runs/${id}/lock`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-runs'] }),
    onError: (e: any) => alert(e?.response?.data?.error || 'Cannot lock'),
  });

  const disburseMutation = useMutation({
    mutationFn: (id: string) => api.put(`/payroll/runs/${id}/disburse`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-runs'] }),
    onError: (e: any) => alert(e?.response?.data?.error || 'Cannot disburse'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll/runs/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-runs'] }),
    onError: (e: any) => alert(e?.response?.data?.error || 'Cannot delete'),
  });

  const runs: any[] = data || [];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Payroll Runs</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>Run payroll, review, lock and disburse</p>
        </div>
        <button onClick={() => setCreateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          <IconPlus size={16} /> Run Payroll
        </button>
      </div>

      {/* Lifecycle guide */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', fontSize: 13 }}>
        {[
          { step: '1', label: 'DRAFT', desc: 'Generated, review payslips', bg: '#f3f4f6', color: '#374151' },
          { step: '2', label: 'LOCKED', desc: 'Frozen — no changes possible', bg: '#fef3c7', color: '#92400e' },
          { step: '3', label: 'DISBURSED', desc: 'Salary credited to employees', bg: '#dcfce7', color: '#15803d' },
        ].map((s, i) => (
          <div key={s.step} style={{ flex: 1, padding: '12px 16px', borderLeft: i > 0 ? '1px solid var(--color-border)' : undefined, background: s.bg }}>
            <div style={{ fontWeight: 700, color: s.color }}>{s.step}. {s.label}</div>
            <div style={{ color: s.color, opacity: 0.8, fontSize: 12 }}>{s.desc}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : runs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)', background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
          No payroll runs yet. Click "Run Payroll" to generate the first one.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['Period', 'Status', 'Gross', 'LOP', 'PF (EE+ER)', 'ESIC', 'TDS', 'Net Pay', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{MONTHS[run.month - 1]} {run.year}</td>
                  <td style={{ padding: '12px' }}>{statusBadge(run.status)}</td>
                  <td style={{ padding: '12px' }}>{fmt(run.totalGross)}</td>
                  <td style={{ padding: '12px', color: '#ef4444' }}>{fmt(run.totalLop)}</td>
                  <td style={{ padding: '12px' }}>{fmt(run.totalPfEmployee)} + {fmt(run.totalPfEmployer)}</td>
                  <td style={{ padding: '12px' }}>{fmt(run.totalEsicEmployee)}</td>
                  <td style={{ padding: '12px' }}>{fmt(run.totalTds)}</td>
                  <td style={{ padding: '12px', fontWeight: 700, color: '#22c55e' }}>{fmt(run.totalNet)}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => navigate(`/payroll/${run.id}`)} title="View payslips"
                        style={{ padding: '5px 10px', border: '1px solid var(--color-border)', borderRadius: 6, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <IconEye size={13} /> View
                      </button>
                      {run.status === 'DRAFT' && (
                        <>
                          <button onClick={() => { if (confirm('Lock this payroll run? This cannot be undone.')) lockMutation.mutate(run.id); }} title="Lock"
                            style={{ padding: '5px 10px', border: '1px solid #fbbf24', borderRadius: 6, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#92400e' }}>
                            <IconLock size={13} /> Lock
                          </button>
                          <button onClick={() => { if (confirm('Delete this draft?')) deleteMutation.mutate(run.id); }} title="Delete"
                            style={{ padding: '5px 8px', border: '1px solid #fecaca', borderRadius: 6, background: 'none', cursor: 'pointer', color: '#ef4444' }}>
                            <IconTrash size={13} />
                          </button>
                        </>
                      )}
                      {run.status === 'LOCKED' && (
                        <button onClick={() => { if (confirm('Mark as Disbursed? Employees will see their payslips.')) disburseMutation.mutate(run.id); }} title="Mark Disbursed"
                          style={{ padding: '5px 10px', border: '1px solid #86efac', borderRadius: 6, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#15803d' }}>
                          <IconCheck size={13} /> Disburse
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 28, width: 360 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Run Payroll</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Payslips will be generated for all active employees with salary data.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Month</label>
                <select value={form.month} onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Year</label>
                <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
              </div>
            </div>
            {createError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{createError}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setCreateModal(false); setCreateError(''); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)', fontSize: 13 }}>Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
                style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                {createMutation.isPending ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
