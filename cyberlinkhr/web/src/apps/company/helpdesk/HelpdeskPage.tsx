import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import {
  IconHeadset, IconPlus, IconX, IconMessageCircle, IconLock,
  IconCircleCheck, IconClock, IconAlertCircle,
  IconDeviceLaptop, IconBuilding, IconClipboardText, IconCoin, IconSettings, IconQuestionMark,
} from '@tabler/icons-react';

const CATEGORIES = ['IT', 'FACILITIES', 'HR_QUERY', 'PAYROLL', 'ADMIN', 'OTHER'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'];

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  LOW:    { bg: '#f1f5f9', text: '#64748b' },
  MEDIUM: { bg: '#fef3c7', text: '#92400e' },
  HIGH:   { bg: '#fee2e2', text: '#991b1b' },
  URGENT: { bg: '#7f1d1d', text: '#fff' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  OPEN:        { bg: '#dbeafe', text: '#1e40af' },
  IN_PROGRESS: { bg: '#fef3c7', text: '#92400e' },
  WAITING:     { bg: '#ede9fe', text: '#5b21b6' },
  RESOLVED:    { bg: '#dcfce7', text: '#166534' },
  CLOSED:      { bg: '#f1f5f9', text: '#64748b' },
};

const CAT_ICONS: Record<string, React.ReactNode> = {
  IT:        <IconDeviceLaptop size={13} />,
  FACILITIES:<IconBuilding size={13} />,
  HR_QUERY:  <IconClipboardText size={13} />,
  PAYROLL:   <IconCoin size={13} />,
  ADMIN:     <IconSettings size={13} />,
  OTHER:     <IconQuestionMark size={13} />,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
  color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box',
};

export default function HelpdeskPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'HR_ADMIN';
  const qc = useQueryClient();

  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ category: 'IT', subject: '', description: '', priority: 'MEDIUM' });
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [error, setError] = useState('');

  const { data: tickets, isLoading } = useQuery<any[]>({
    queryKey: ['helpdesk-tickets'],
    queryFn: () => api.get('/helpdesk').then(r => r.data.data),
  });

  const { data: stats } = useQuery<Record<string, number>>({
    queryKey: ['helpdesk-stats'],
    queryFn: () => api.get('/helpdesk/stats').then(r => r.data.data),
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/helpdesk', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['helpdesk-tickets'] });
      qc.invalidateQueries({ queryKey: ['helpdesk-stats'] });
      setShowCreate(false);
      setForm({ category: 'IT', subject: '', description: '', priority: 'MEDIUM' });
      setError('');
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: any) => api.patch(`/helpdesk/${id}`, body),
    onSuccess: async (_, vars) => {
      qc.invalidateQueries({ queryKey: ['helpdesk-tickets'] });
      qc.invalidateQueries({ queryKey: ['helpdesk-stats'] });
      const res = await api.get(`/helpdesk/${vars.id}`);
      setDetail(res.data.data);
      setSelected(res.data.data);
    },
  });

  const commentMutation = useMutation({
    mutationFn: ({ id, body }: any) => api.post(`/helpdesk/${id}/comments`, body),
    onSuccess: async (_, vars) => {
      setCommentText(''); setIsInternal(false);
      qc.invalidateQueries({ queryKey: ['helpdesk-tickets'] });
      const res = await api.get(`/helpdesk/${vars.id}`);
      setDetail(res.data.data);
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const openDetail = async (t: any) => {
    setSelected(t);
    setError('');
    const res = await api.get(`/helpdesk/${t.id}`);
    setDetail(res.data.data);
  };

  const filtered = (tickets || []).filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterCat && t.category !== filterCat) return false;
    return true;
  });

  const openCount = (tickets || []).filter(t => t.status === 'OPEN').length;

  return (
    <div style={{ padding: 24, maxWidth: 1150, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconHeadset size={20} style={{ color: 'var(--brand)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Help Desk</h1>
            <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 13 }}>Raise and track internal support tickets</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin && openCount > 0 && (
            <div style={{ background: '#dbeafe', color: '#1e40af', padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              {openCount} open
            </div>
          )}
          <button onClick={() => { setShowCreate(true); setError(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            <IconPlus size={15} /> New Ticket
          </button>
        </div>
      </div>

      {/* Admin stat chips */}
      {isAdmin && stats && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {STATUSES.map(s => {
            const sc = STATUS_COLORS[s];
            const cnt = stats[s] || 0;
            return (
              <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
                style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${filterStatus === s ? sc.text : 'transparent'}`, background: sc.bg, color: sc.text, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                {s.replace('_', ' ')} · {cnt}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: detail ? '380px 1fr' : '1fr', gap: 20 }}>
        {/* Ticket list */}
        <div>
          {/* Category filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterCat('')}
              style={{ padding: '4px 10px', borderRadius: 16, border: `1.5px solid ${!filterCat ? 'var(--brand)' : 'var(--border)'}`, background: !filterCat ? 'var(--brand)' : 'none', color: !filterCat ? '#fff' : 'var(--text-2)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              All
            </button>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setFilterCat(filterCat === c ? '' : c)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 16, border: `1.5px solid ${filterCat === c ? 'var(--brand)' : 'var(--border)'}`, background: filterCat === c ? 'var(--brand)' : 'none', color: filterCat === c ? '#fff' : 'var(--text-2)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                {CAT_ICONS[c]} {c.replace('_', ' ')}
              </button>
            ))}
          </div>

          {isLoading ? <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading...</div>
            : !filtered.length ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
                <IconHeadset size={36} style={{ opacity: 0.2, display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No tickets found</div>
                <div style={{ fontSize: 12 }}>Raise a new ticket to get support</div>
              </div>
            ) : filtered.map((t: any) => {
              const sc = STATUS_COLORS[t.status] || STATUS_COLORS.OPEN;
              const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.MEDIUM;
              return (
                <div key={t.id} onClick={() => openDetail(t)}
                  style={{ padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${selected?.id === t.id ? 'var(--color-primary)' : 'var(--color-border)'}`, marginBottom: 8, cursor: 'pointer', background: 'var(--color-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{t.ticketNumber}</span>
                      <span style={{ background: pc.bg, color: pc.text, padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{t.priority}</span>
                    </div>
                    <span style={{ background: sc.bg, color: sc.text, padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{t.status.replace('_', ' ')}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{t.subject}</div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--color-text-secondary)', alignItems: 'center' }}>
                    <span>{CAT_ICONS[t.category]} {t.category.replace('_', ' ')}</span>
                    {isAdmin && <span>· {t.employeeName}</span>}
                    {t.commentCount > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        · <IconMessageCircle size={10} /> {t.commentCount}
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto' }}>{new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Detail panel */}
        {detail && (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', minWidth: 0 }}>
            {/* Header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-secondary)' }}>{detail.ticketNumber}</span>
                  <span style={{ ...PRIORITY_COLORS[detail.priority], padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{detail.priority}</span>
                  <span style={{ ...STATUS_COLORS[detail.status], padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{detail.status.replace('_', ' ')}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{detail.subject}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {CAT_ICONS[detail.category]} {detail.category.replace('_', ' ')}
                  {isAdmin && ` · ${detail.employeeName}`}
                  {' · '}{new Date(detail.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <button onClick={() => { setDetail(null); setSelected(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                <IconX size={16} />
              </button>
            </div>

            {/* Description */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', fontSize: 13, lineHeight: 1.7 }}>
              {detail.description}
            </div>

            {/* HR actions */}
            {isAdmin && !['RESOLVED', 'CLOSED'].includes(detail.status) && (
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>SET STATUS</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {STATUSES.filter(s => s !== detail.status).map(s => {
                    const sc = STATUS_COLORS[s];
                    return (
                      <button key={s} onClick={() => updateMutation.mutate({ id: detail.id, body: { status: s } })}
                        style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${sc.bg}`, background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: sc.text }}>
                        {s.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Comments */}
            <div style={{ padding: '14px 18px', maxHeight: 340, overflowY: 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 10 }}>THREAD</div>
              {!(detail.comments || []).length && (
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>No replies yet.</div>
              )}
              {(detail.comments || []).map((c: any) => {
                const isHR = c.authorRole === 'HR_ADMIN';
                return (
                  <div key={c.id} style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: isHR ? 'var(--color-primary)' : 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: isHR ? '#fff' : 'var(--color-text)', flexShrink: 0 }}>
                      {isHR ? 'HR' : (c.authorName?.[0] || '?')}
                    </div>
                    <div style={{ flex: 1, background: c.isInternal ? '#fef9ec' : 'var(--color-background)', border: `1px solid ${c.isInternal ? '#fde68a' : 'var(--color-border)'}`, borderRadius: 10, padding: '8px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{isHR ? 'HR Team' : c.authorName}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {c.isInternal && <span style={{ fontSize: 10, color: '#92400e', display: 'flex', alignItems: 'center', gap: 2 }}><IconLock size={9} /> Internal</span>}
                          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{new Date(c.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 13 }}>{c.comment}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reply box */}
            {!['RESOLVED', 'CLOSED'].includes(detail.status) && (
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--color-border)' }}>
                <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical', marginBottom: 8 }}
                  placeholder="Write a reply..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {isAdmin ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                      <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} />
                      <IconLock size={11} /> Internal note
                    </label>
                  ) : <span />}
                  <button onClick={() => commentMutation.mutate({ id: detail.id, body: { comment: commentText, isInternal } })}
                    disabled={!commentText.trim() || commentMutation.isPending}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <IconMessageCircle size={13} /> {commentMutation.isPending ? 'Sending...' : 'Reply'}
                  </button>
                </div>
                {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{error}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 500 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Raise a Ticket</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Category *</label>
                  <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c.replace('_', ' ')}</option>)}
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
                <input style={inputStyle} placeholder="Brief summary of the issue" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Description *</label>
                <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} placeholder="Describe the issue in detail..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCreate(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {createMutation.isPending ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
