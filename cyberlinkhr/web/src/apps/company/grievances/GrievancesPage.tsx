import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { IconShield, IconPlus, IconX, IconMessageCircle, IconLock } from '@tabler/icons-react';

const CATEGORIES = ['HARASSMENT', 'DISCRIMINATION', 'WORKPLACE_SAFETY', 'SALARY', 'MANAGEMENT', 'POLICY', 'OTHER'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: '#fef3c7', text: '#92400e' },
  IN_REVIEW: { bg: '#dbeafe', text: '#1e40af' },
  RESOLVED: { bg: '#dcfce7', text: '#166534' },
  CLOSED: { bg: '#f1f5f9', text: '#64748b' },
};
const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  LOW: { bg: '#f1f5f9', text: '#64748b' },
  MEDIUM: { bg: '#fef3c7', text: '#92400e' },
  HIGH: { bg: '#fee2e2', text: '#991b1b' },
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
  color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box',
};

export default function GrievancesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'HR_ADMIN';
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [form, setForm] = useState({ category: 'OTHER', subject: '', description: '', priority: 'MEDIUM' });
  const [statusForm, setStatusForm] = useState({ status: '', resolution: '' });
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [error, setError] = useState('');

  const { data: list, isLoading } = useQuery<any[]>({
    queryKey: ['grievances'],
    queryFn: () => api.get('/grievances').then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/grievances', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grievances'] }); setShowCreate(false); setForm({ category: 'OTHER', subject: '', description: '', priority: 'MEDIUM' }); setError(''); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, body }: any) => api.patch(`/grievances/${id}/status`, body),
    onSuccess: async (_, vars) => {
      qc.invalidateQueries({ queryKey: ['grievances'] });
      const res = await api.get(`/grievances/${vars.id}`);
      setDetailData(res.data.data);
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const commentMutation = useMutation({
    mutationFn: ({ id, body }: any) => api.post(`/grievances/${id}/comments`, body),
    onSuccess: async (_, vars) => {
      setCommentText(''); setIsInternal(false);
      const res = await api.get(`/grievances/${vars.id}`);
      setDetailData(res.data.data);
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const openDetail = async (g: any) => {
    setSelected(g);
    setStatusForm({ status: g.status, resolution: '' });
    setError('');
    const res = await api.get(`/grievances/${g.id}`);
    setDetailData(res.data.data);
  };

  const openCount = (list || []).filter(g => g.status === 'OPEN').length;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--warning-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconShield size={20} style={{ color: 'var(--warning)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Grievance Management</h1>
            <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 13 }}>Submit and manage confidential workplace complaints</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin && openCount > 0 && (
            <div style={{ background: '#fef3c7', color: '#92400e', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              {openCount} open
            </div>
          )}
          <button onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            <IconPlus size={15} /> Raise Grievance
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        {/* List */}
        <div>
          {isLoading ? <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading...</div>
            : !(list || []).length ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', border: '1px dashed var(--border)', borderRadius: 12 }}>
                <IconShield size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No grievances filed</div>
                <div style={{ fontSize: 12 }}>All complaints are handled confidentially</div>
              </div>
            ) : (list || []).map((g: any) => {
              const sc = STATUS_COLORS[g.status] || STATUS_COLORS.OPEN;
              const pc = PRIORITY_COLORS[g.priority] || PRIORITY_COLORS.MEDIUM;
              return (
                <div key={g.id} onClick={() => openDetail(g)}
                  style={{ padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${selected?.id === g.id ? 'var(--color-primary)' : 'var(--color-border)'}`, marginBottom: 8, cursor: 'pointer', background: 'var(--color-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{g.subject}</span>
                    <span style={{ background: sc.bg, color: sc.text, padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{g.status.replace('_', ' ')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ background: pc.bg, color: pc.text, padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{g.priority}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{g.category.replace('_', ' ')}</span>
                    {isAdmin && <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>{g.employeeName}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    {new Date(g.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Detail */}
        <div>
          {!selected ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
              <IconShield size={36} style={{ opacity: 0.25, display: 'block', margin: '0 auto 12px' }} />
              Select a grievance to view details
            </div>
          ) : (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{selected.subject}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: selected.status.replace('_', ' '), ...STATUS_COLORS[selected.status] },
                    { label: selected.priority, ...PRIORITY_COLORS[selected.priority] },
                    { label: selected.category.replace('_', ' '), bg: '#f1f5f9', text: '#475569' },
                  ].map(b => (
                    <span key={b.label} style={{ background: b.bg, color: b.text, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{b.label}</span>
                  ))}
                  {isAdmin && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 4 }}>by {selected.employeeName}</span>}
                </div>
              </div>

              {/* Description */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>{detailData?.description || selected.description}</div>
              </div>

              {/* Resolution (if any) */}
              {detailData?.resolution && (
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', background: '#f0fdf4' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 4 }}>Resolution</div>
                  <div style={{ fontSize: 13 }}>{detailData.resolution}</div>
                </div>
              )}

              {/* HR status update */}
              {isAdmin && selected.status !== 'CLOSED' && (
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>HR ACTIONS</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'].map(s => (
                      <button key={s} onClick={() => setStatusForm(f => ({ ...f, status: s }))}
                        style={{ padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${statusForm.status === s ? 'var(--color-primary)' : 'var(--color-border)'}`, background: statusForm.status === s ? 'var(--color-primary)' : 'none', color: statusForm.status === s ? '#fff' : 'var(--color-text)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        {s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                  {(statusForm.status === 'RESOLVED' || statusForm.status === 'CLOSED') && (
                    <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical', marginBottom: 8 }}
                      placeholder="Resolution details..." value={statusForm.resolution}
                      onChange={e => setStatusForm(f => ({ ...f, resolution: e.target.value }))} />
                  )}
                  <button onClick={() => statusMutation.mutate({ id: selected.id, body: statusForm })} disabled={statusMutation.isPending}
                    style={{ padding: '7px 16px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                    {statusMutation.isPending ? 'Updating...' : 'Update Status'}
                  </button>
                </div>
              )}

              {/* Comments */}
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 12 }}>COMMENTS</div>
                {detailData?.comments?.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>No comments yet.</div>
                )}
                {(detailData?.comments || []).map((c: any) => (
                  <div key={c.id} style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: c.isInternal ? '#fef9ec' : 'var(--color-background)', border: `1px solid ${c.isInternal ? '#fde68a' : 'var(--color-border)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{c.authorName || 'HR'}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {c.isInternal && <span style={{ fontSize: 10, color: '#92400e', display: 'flex', alignItems: 'center', gap: 2 }}><IconLock size={10} /> Internal</span>}
                        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 13 }}>{c.comment}</div>
                  </div>
                ))}

                {/* Add comment */}
                {selected.status !== 'CLOSED' && (
                  <div style={{ marginTop: 12 }}>
                    <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical', marginBottom: 8 }}
                      placeholder="Add a comment..." value={commentText}
                      onChange={e => setCommentText(e.target.value)} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {isAdmin && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                          <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} />
                          <IconLock size={12} /> Internal note (hidden from employee)
                        </label>
                      )}
                      <button onClick={() => commentMutation.mutate({ id: selected.id, body: { comment: commentText, isInternal } })}
                        disabled={!commentText.trim() || commentMutation.isPending}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginLeft: 'auto' }}>
                        <IconMessageCircle size={14} /> {commentMutation.isPending ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 500 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Raise Grievance</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Category *</label>
                  <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Priority</label>
                  <select style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Subject *</label>
                <input style={inputStyle} placeholder="Brief description of the issue" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Description *</label>
                <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} placeholder="Describe the grievance in detail..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 10, fontSize: 12, color: '#1e40af' }}>
                Your grievance will be handled confidentially by HR.
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCreate(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {createMutation.isPending ? 'Submitting...' : 'Submit Grievance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
