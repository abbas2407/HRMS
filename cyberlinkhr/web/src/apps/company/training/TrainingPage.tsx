import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { IconSchool, IconPlus, IconX, IconUsers, IconCheck } from '@tabler/icons-react';

const TYPES = ['TECHNICAL', 'SOFT_SKILLS', 'COMPLIANCE', 'LEADERSHIP', 'OTHER'];
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  TECHNICAL: { bg: '#dbeafe', text: '#1e40af' },
  SOFT_SKILLS: { bg: '#fce7f3', text: '#9d174d' },
  COMPLIANCE: { bg: '#fef3c7', text: '#92400e' },
  LEADERSHIP: { bg: '#ede9fe', text: '#5b21b6' },
  OTHER: { bg: '#f1f5f9', text: '#475569' },
};
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  UPCOMING: { bg: '#dbeafe', text: '#1e40af' },
  ONGOING: { bg: '#dcfce7', text: '#166534' },
  COMPLETED: { bg: '#f1f5f9', text: '#64748b' },
  CANCELLED: { bg: '#fee2e2', text: '#991b1b' },
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
  color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box',
};

export default function TrainingPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'HR_ADMIN';
  const qc = useQueryClient();

  const [selectedProgram, setSelectedProgram] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollEmpId, setEnrollEmpId] = useState('');
  const [form, setForm] = useState({ title: '', type: 'TECHNICAL', description: '', trainer: '', startDate: '', endDate: '', maxCapacity: '' });
  const [error, setError] = useState('');

  const { data: programs, isLoading } = useQuery<any[]>({
    queryKey: ['training-programs'],
    queryFn: () => api.get('/training').then(r => r.data.data),
  });

  const { data: enrollments } = useQuery<any[]>({
    queryKey: ['training-enrollments', selectedProgram?.id],
    queryFn: () => api.get(`/training/${selectedProgram.id}/enrollments`).then(r => r.data.data),
    enabled: !!selectedProgram && isAdmin,
  });

  const { data: myTrainings } = useQuery<any[]>({
    queryKey: ['my-trainings'],
    queryFn: () => api.get('/training/my').then(r => r.data.data),
    enabled: !isAdmin,
  });

  const { data: employees } = useQuery<any[]>({
    queryKey: ['employees-list'],
    queryFn: () => api.get('/employees').then(r => r.data.data),
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/training', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training-programs'] }); setShowCreate(false); setForm({ title: '', type: 'TECHNICAL', description: '', trainer: '', startDate: '', endDate: '', maxCapacity: '' }); setError(''); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: any) => api.patch(`/training/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-programs'] }),
  });

  const enrollMutation = useMutation({
    mutationFn: ({ id, employeeId }: any) => api.post(`/training/${id}/enroll`, { employeeId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training-enrollments', selectedProgram?.id] }); setShowEnroll(false); setEnrollEmpId(''); setError(''); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const completeMutation = useMutation({
    mutationFn: (enrollmentId: string) => api.patch(`/training/enrollments/${enrollmentId}/complete`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-enrollments', selectedProgram?.id] }),
  });

  const nextStatus: Record<string, string> = { UPCOMING: 'ONGOING', ONGOING: 'COMPLETED' };

  if (!isAdmin) {
    // Employee view: my enrolled trainings
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconSchool size={20} style={{ color: 'var(--brand)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>My Trainings</h1>
            <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 13 }}>Your enrolled training programs</p>
          </div>
        </div>

        {/* All programs for browsing */}
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 10 }}>Available Programs</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 32 }}>
          {(programs || []).filter((p: any) => p.status !== 'CANCELLED').map((p: any) => {
            const tc = TYPE_COLORS[p.type] || TYPE_COLORS.OTHER;
            const sc = STATUS_COLORS[p.status] || STATUS_COLORS.UPCOMING;
            return (
              <div key={p.id} style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, background: 'var(--color-surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ background: tc.bg, color: tc.text, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{p.type.replace('_', ' ')}</span>
                  <span style={{ background: sc.bg, color: sc.text, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{p.status}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.title}</div>
                {p.trainer && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Trainer: {p.trainer}</div>}
                {p.startDate && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{p.startDate} {p.endDate ? `→ ${p.endDate}` : ''}</div>}
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 10 }}>My Enrollments</div>
        {!(myTrainings || []).length ? (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Not enrolled in any training yet.</div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-surface)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
                  {['Program', 'Type', 'Trainer', 'Date', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(myTrainings || []).map((t: any) => {
                  const sc = STATUS_COLORS[t.enrollmentStatus] || STATUS_COLORS.UPCOMING;
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '11px 14px', fontWeight: 600 }}>{t.title}</td>
                      <td style={{ padding: '11px 14px' }}><span style={{ background: TYPE_COLORS[t.type]?.bg || '#f1f5f9', color: TYPE_COLORS[t.type]?.text || '#475569', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{t.type?.replace('_', ' ')}</span></td>
                      <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)' }}>{t.trainer || '—'}</td>
                      <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)', fontSize: 12 }}>{t.startDate || '—'}</td>
                      <td style={{ padding: '11px 14px' }}><span style={{ background: sc.bg, color: sc.text, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{t.enrollmentStatus}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconSchool size={20} style={{ color: 'var(--brand)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Training & Development</h1>
            <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 13 }}>Schedule and track employee training programs</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          <IconPlus size={15} /> New Program
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        {/* Program list */}
        <div>
          {isLoading ? (
            <div style={{ color: 'var(--text-3)', padding: 24, textAlign: 'center' }}>Loading programs...</div>
          ) : !(programs || []).length ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', border: '1px dashed var(--border)', borderRadius: 12 }}>
              <IconSchool size={32} style={{ opacity: 0.25, display: 'block', margin: '0 auto 10px' }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No programs yet</div>
              <div style={{ fontSize: 12 }}>Create a training program to get started</div>
            </div>
          ) : (programs || []).map((p: any) => {
            const tc = TYPE_COLORS[p.type] || TYPE_COLORS.OTHER;
            const sc = STATUS_COLORS[p.status] || STATUS_COLORS.UPCOMING;
            return (
              <div key={p.id} onClick={() => setSelectedProgram(p)}
                style={{ padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${selectedProgram?.id === p.id ? 'var(--color-primary)' : 'var(--color-border)'}`, marginBottom: 8, cursor: 'pointer', background: 'var(--color-surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</span>
                  <span style={{ background: sc.bg, color: sc.text, padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{p.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ background: tc.bg, color: tc.text, padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{p.type.replace('_', ' ')}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}><IconUsers size={11} style={{ verticalAlign: 'middle' }} /> {p.enrollmentCount || 0}{p.maxCapacity ? `/${p.maxCapacity}` : ''}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        <div>
          {!selectedProgram ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
              <IconSchool size={36} style={{ opacity: 0.25, display: 'block', margin: '0 auto 12px' }} />
              Select a program to manage enrollments
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedProgram.title}</div>
                  {selectedProgram.trainer && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Trainer: {selectedProgram.trainer}</div>}
                  {selectedProgram.description && <div style={{ fontSize: 13, marginTop: 4 }}>{selectedProgram.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {nextStatus[selectedProgram.status] && (
                    <button onClick={() => { statusMutation.mutate({ id: selectedProgram.id, status: nextStatus[selectedProgram.status] }); setSelectedProgram((p: any) => ({ ...p, status: nextStatus[p.status] })); }}
                      style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 13 }}>
                      Mark {nextStatus[selectedProgram.status]}
                    </button>
                  )}
                  <button onClick={() => { setShowEnroll(true); setError(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                    <IconPlus size={14} /> Enroll Employee
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
                      {['Employee', 'Enrolled On', 'Status', 'Completed On', 'Actions'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!(enrollments || []).length ? (
                      <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No enrollments yet</td></tr>
                    ) : (enrollments || []).map((e: any) => {
                      const sc = STATUS_COLORS[e.status] || STATUS_COLORS.UPCOMING;
                      return (
                        <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ fontWeight: 600 }}>{e.employeeName}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{e.employeeCode}</div>
                          </td>
                          <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)', fontSize: 12 }}>
                            {new Date(e.enrolledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ background: sc.bg, color: sc.text, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{e.status}</span>
                          </td>
                          <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)', fontSize: 12 }}>
                            {e.completedAt ? new Date(e.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            {e.status === 'ENROLLED' && (
                              <button onClick={() => completeMutation.mutate(e.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, border: '1px solid #bbf7d0', background: 'none', cursor: 'pointer', fontSize: 12, color: '#166534' }}>
                                <IconCheck size={12} /> Mark Complete
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create program modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>New Training Program</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Title *</label>
                <input style={inputStyle} placeholder="e.g. React Advanced Workshop" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Type</label>
                  <select style={inputStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Trainer</label>
                  <input style={inputStyle} value={form.trainer} onChange={e => setForm(f => ({ ...f, trainer: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Start Date</label>
                  <input type="date" style={inputStyle} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>End Date</label>
                  <input type="date" style={inputStyle} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Max Capacity</label>
                  <input type="number" style={inputStyle} value={form.maxCapacity} onChange={e => setForm(f => ({ ...f, maxCapacity: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Description</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCreate(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => createMutation.mutate({ ...form, maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : undefined })} disabled={createMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enroll modal */}
      {showEnroll && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 400 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Enroll Employee</div>
              <button onClick={() => setShowEnroll(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Employee *</label>
                <select style={inputStyle} value={enrollEmpId} onChange={e => setEnrollEmpId(e.target.value)}>
                  <option value="">Select employee...</option>
                  {(employees || []).map((e: any) => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
                  ))}
                </select>
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowEnroll(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => enrollMutation.mutate({ id: selectedProgram.id, employeeId: enrollEmpId })} disabled={enrollMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {enrollMutation.isPending ? 'Enrolling...' : 'Enroll'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
