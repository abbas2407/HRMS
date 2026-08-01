import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { IconChartBar, IconPlus, IconX, IconStar, IconCheck, IconLock } from '@tabler/icons-react';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#f1f5f9', text: '#64748b' },
  SELF_SUBMITTED: { bg: '#dbeafe', text: '#1e40af' },
  MANAGER_REVIEWED: { bg: '#dcfce7', text: '#166534' },
};

const CYCLE_STATUS: Record<string, { bg: string; text: string }> = {
  ACTIVE: { bg: '#dcfce7', text: '#166534' },
  CLOSED: { bg: '#f1f5f9', text: '#64748b' },
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
  color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box',
};

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => onChange?.(n)} style={{ background: 'none', border: 'none', cursor: onChange ? 'pointer' : 'default', padding: 2 }}>
          <IconStar size={18} fill={n <= value ? '#f59e0b' : 'none'} color={n <= value ? '#f59e0b' : '#cbd5e1'} />
        </button>
      ))}
      {value > 0 && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 4, lineHeight: '22px' }}>{value}/5</span>}
    </div>
  );
}

export default function PerformancePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'HR_ADMIN';
  const isManager = user?.role === 'MANAGER' || isAdmin;
  const qc = useQueryClient();

  const [selectedCycle, setSelectedCycle] = useState<any>(null);
  const [showCreateCycle, setShowCreateCycle] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [selfTarget, setSelfTarget] = useState<any>(null);
  const [cycleForm, setCycleForm] = useState({ name: '', period: new Date().getFullYear().toString(), startDate: '', endDate: '' });
  const [selfForm, setSelfForm] = useState<{ goals: { title: string; rating: number; comments: string }[]; selfRating: number; selfComments: string }>({ goals: [], selfRating: 0, selfComments: '' });
  const [managerForm, setManagerForm] = useState({ managerRating: 0, managerComments: '' });
  const [error, setError] = useState('');

  const { data: cycles } = useQuery<any[]>({
    queryKey: ['appraisal-cycles'],
    queryFn: () => api.get('/performance/cycles').then(r => r.data.data),
  });

  const { data: submissions } = useQuery<any[]>({
    queryKey: ['appraisal-submissions', selectedCycle?.id],
    queryFn: () => api.get(`/performance/submissions?cycleId=${selectedCycle.id}`).then(r => r.data.data),
    enabled: !!selectedCycle && isManager,
  });

  const { data: mySubmission } = useQuery<any>({
    queryKey: ['my-appraisal', selectedCycle?.id],
    queryFn: () => api.get(`/performance/submissions/mine/${selectedCycle.id}`).then(r => r.data.data),
    enabled: !!selectedCycle && !isManager,
  });

  const createCycleMutation = useMutation({
    mutationFn: (body: any) => api.post('/performance/cycles', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appraisal-cycles'] }); setShowCreateCycle(false); setError(''); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const closeCycleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/performance/cycles/${id}/close`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appraisal-cycles'] }),
  });

  const selfMutation = useMutation({
    mutationFn: ({ id, body }: any) => api.patch(`/performance/submissions/${id}/self`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appraisal-submissions', selectedCycle?.id] });
      qc.invalidateQueries({ queryKey: ['my-appraisal', selectedCycle?.id] });
      setSelfTarget(null); setError('');
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const managerMutation = useMutation({
    mutationFn: ({ id, body }: any) => api.patch(`/performance/submissions/${id}/manager`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appraisal-submissions', selectedCycle?.id] }); setReviewTarget(null); setError(''); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const openSelf = (sub: any) => {
    setSelfTarget(sub);
    const goals = Array.isArray(sub.goals) && sub.goals.length > 0
      ? sub.goals.map((g: any) => ({ title: g.title || '', rating: g.rating || 0, comments: g.comments || '' }))
      : [{ title: '', rating: 0, comments: '' }];
    setSelfForm({ goals, selfRating: sub.selfRating || 0, selfComments: sub.selfComments || '' });
    setError('');
  };

  const effectiveSub = isManager ? null : mySubmission;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--purple-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconChartBar size={20} style={{ color: 'var(--purple)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Performance Management</h1>
            <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 13 }}>Run appraisal cycles and manage employee reviews</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreateCycle(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            <IconPlus size={15} /> New Cycle
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        {/* Cycle list */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>Cycles</div>
          {!(cycles || []).length ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', border: '1px dashed var(--border)', borderRadius: 10 }}>
              <IconChartBar size={28} style={{ opacity: 0.2, display: 'block', margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600, marginBottom: 3 }}>No cycles yet</div>
              <div style={{ fontSize: 11 }}>Create a cycle to start reviews</div>
            </div>
          ) : (cycles || []).map((c: any) => {
            const sc = CYCLE_STATUS[c.status] || CYCLE_STATUS.ACTIVE;
            return (
              <div key={c.id} onClick={() => setSelectedCycle(c)}
                style={{ padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${selectedCycle?.id === c.id ? 'var(--color-primary)' : 'var(--color-border)'}`, marginBottom: 8, cursor: 'pointer', background: 'var(--color-surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                  <span style={{ background: sc.bg, color: sc.text, padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{c.status}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3 }}>{c.period}</div>
                {isAdmin && c.status === 'ACTIVE' && (
                  <button onClick={(e) => { e.stopPropagation(); closeCycleMutation.mutate(c.id); }}
                    style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    <IconLock size={11} /> Close
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Right panel */}
        <div>
          {!selectedCycle ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
              <IconChartBar size={36} style={{ opacity: 0.25, display: 'block', margin: '0 auto 12px' }} />
              Select a cycle to view appraisals
            </div>
          ) : isManager ? (
            // Manager/admin view: all submissions
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{selectedCycle.name} — All Appraisals</div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
                      {['Employee', 'Status', 'Self Rating', 'Manager Rating', 'Actions'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!(submissions || []).length ? (
                      <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No submissions</td></tr>
                    ) : (submissions || []).map((s: any) => {
                      const sc = STATUS_COLORS[s.status] || STATUS_COLORS.PENDING;
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ fontWeight: 600 }}>{s.employeeName}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{s.employeeCode}</div>
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ background: sc.bg, color: sc.text, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{s.status.replace('_', ' ')}</span>
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            {s.selfRating ? <StarRating value={s.selfRating} /> : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            {s.managerRating ? <StarRating value={s.managerRating} /> : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            {s.status === 'SELF_SUBMITTED' && (
                              <button onClick={() => { setReviewTarget(s); setManagerForm({ managerRating: s.managerRating || 0, managerComments: s.managerComments || '' }); setError(''); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, border: '1px solid #bfdbfe', background: 'none', cursor: 'pointer', fontSize: 12, color: '#1d4ed8' }}>
                                <IconCheck size={12} /> Review
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
          ) : (
            // Employee view: own submission
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{selectedCycle.name} — My Appraisal</div>
              {!effectiveSub ? (
                <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>No appraisal found for this cycle.</div>
              ) : (
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Status</div>
                      <span style={{ background: STATUS_COLORS[effectiveSub.status]?.bg, color: STATUS_COLORS[effectiveSub.status]?.text, padding: '2px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                        {effectiveSub.status.replace('_', ' ')}
                      </span>
                    </div>
                    {effectiveSub.selfRating && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Self Rating</div>
                        <StarRating value={effectiveSub.selfRating} />
                      </div>
                    )}
                    {effectiveSub.managerRating && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Manager Rating</div>
                        <StarRating value={effectiveSub.managerRating} />
                      </div>
                    )}
                  </div>
                  {effectiveSub.managerComments && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 4 }}>Manager Feedback</div>
                      <div style={{ fontSize: 13 }}>{effectiveSub.managerComments}</div>
                    </div>
                  )}
                  {effectiveSub.status === 'PENDING' && selectedCycle.status === 'ACTIVE' && (
                    <button onClick={() => openSelf(effectiveSub)}
                      style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                      Submit Self Appraisal
                    </button>
                  )}
                  {effectiveSub.status === 'SELF_SUBMITTED' && (
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Submitted. Waiting for manager review.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create cycle modal */}
      {showCreateCycle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 440 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>New Appraisal Cycle</div>
              <button onClick={() => setShowCreateCycle(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Cycle Name *</label>
                <input style={inputStyle} placeholder="e.g. Annual Appraisal 2025" value={cycleForm.name} onChange={e => setCycleForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Period (Year) *</label>
                <input style={inputStyle} placeholder="2025" value={cycleForm.period} onChange={e => setCycleForm(f => ({ ...f, period: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Start Date *</label>
                  <input type="date" style={inputStyle} value={cycleForm.startDate} onChange={e => setCycleForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>End Date *</label>
                  <input type="date" style={inputStyle} value={cycleForm.endDate} onChange={e => setCycleForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCreateCycle(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => createCycleMutation.mutate(cycleForm)} disabled={createCycleMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {createCycleMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Self appraisal modal */}
      {selfTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Self Appraisal</div>
              <button onClick={() => setSelfTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Goals</label>
                  <button onClick={() => setSelfForm(f => ({ ...f, goals: [...f.goals, { title: '', rating: 0, comments: '' }] }))}
                    style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <IconPlus size={13} /> Add Goal
                  </button>
                </div>
                {selfForm.goals.map((g, i) => (
                  <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <input style={{ ...inputStyle, marginBottom: 8 }} placeholder={`Goal ${i + 1} title`} value={g.title}
                      onChange={e => setSelfForm(f => { const gs = [...f.goals]; gs[i] = { ...gs[i], title: e.target.value }; return { ...f, goals: gs }; })} />
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Self Rating</div>
                      <StarRating value={g.rating} onChange={v => setSelfForm(f => { const gs = [...f.goals]; gs[i] = { ...gs[i], rating: v }; return { ...f, goals: gs }; })} />
                    </div>
                    <input style={inputStyle} placeholder="Comments" value={g.comments}
                      onChange={e => setSelfForm(f => { const gs = [...f.goals]; gs[i] = { ...gs[i], comments: e.target.value }; return { ...f, goals: gs }; })} />
                  </div>
                ))}
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Overall Self Rating *</label>
                <StarRating value={selfForm.selfRating} onChange={v => setSelfForm(f => ({ ...f, selfRating: v }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Overall Comments</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={selfForm.selfComments}
                  onChange={e => setSelfForm(f => ({ ...f, selfComments: e.target.value }))} />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setSelfTarget(null)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => selfMutation.mutate({ id: selfTarget.id, body: selfForm })} disabled={selfMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {selfMutation.isPending ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manager review modal */}
      {reviewTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Manager Review — {reviewTarget.employeeName}</div>
              <button onClick={() => setReviewTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Employee self-appraisal summary */}
              <div style={{ background: 'var(--color-background)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>EMPLOYEE SELF-APPRAISAL</div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Self Rating: </span>
                  <StarRating value={reviewTarget.selfRating || 0} />
                </div>
                {reviewTarget.selfComments && <div style={{ fontSize: 13 }}>{reviewTarget.selfComments}</div>}
                {Array.isArray(reviewTarget.goals) && reviewTarget.goals.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {reviewTarget.goals.map((g: any, i: number) => (
                      <div key={i} style={{ fontSize: 13, marginBottom: 6, paddingLeft: 8, borderLeft: '2px solid var(--color-border)' }}>
                        <strong>{g.title}</strong> {g.rating ? `— ${g.rating}/5` : ''}<br />
                        {g.comments && <span style={{ color: 'var(--color-text-secondary)' }}>{g.comments}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Manager Rating *</label>
                <StarRating value={managerForm.managerRating} onChange={v => setManagerForm(f => ({ ...f, managerRating: v }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Manager Comments</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={managerForm.managerComments}
                  onChange={e => setManagerForm(f => ({ ...f, managerComments: e.target.value }))} />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setReviewTarget(null)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => managerMutation.mutate({ id: reviewTarget.id, body: managerForm })} disabled={managerMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {managerMutation.isPending ? 'Saving...' : 'Submit Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
