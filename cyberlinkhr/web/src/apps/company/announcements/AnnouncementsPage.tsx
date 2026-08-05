import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { IconSpeakerphone, IconPin, IconTrash, IconPlus, IconX, IconPencil } from '@tabler/icons-react';
import { toast } from '@/components/ui/Toast';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
  color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'HR_ADMIN';

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', body: '', targetType: 'ALL', departmentId: '', isPinned: false, expiresAt: '' });
  const [error, setError] = useState('');

  const emptyForm = { title: '', body: '', targetType: 'ALL', departmentId: '', isPinned: false, expiresAt: '' };

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  }

  function openEdit(a: any) {
    setEditingId(a.id);
    setForm({
      title: a.title,
      body: a.body,
      targetType: a.targetType || 'ALL',
      departmentId: a.departmentId || '',
      isPinned: a.isPinned || false,
      expiresAt: a.expiresAt ? a.expiresAt.split('T')[0] : '',
    });
    setError('');
    setShowModal(true);
  }

  const { data: announcements, isLoading } = useQuery<any[]>({
    queryKey: ['announcements'],
    queryFn: () => api.get('/announcements').then(r => r.data.data),
  });

  const { data: depts } = useQuery<any[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data.data),
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/announcements', body).then(r => r.data),
    onSuccess: () => {
      toast.success('Announcement posted');
      qc.invalidateQueries({ queryKey: ['announcements'] });
      setShowModal(false);
      setForm(emptyForm);
      setError('');
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || 'Failed to create';
      setError(msg);
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.put(`/announcements/${id}`, body).then(r => r.data),
    onSuccess: () => {
      toast.success('Announcement updated');
      qc.invalidateQueries({ queryKey: ['announcements'] });
      setShowModal(false);
      setForm(emptyForm);
      setEditingId(null);
      setError('');
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || 'Failed to update';
      setError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => {
      toast.success('Announcement deleted');
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: () => toast.error('Failed to delete'),
  });

  const pinMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/announcements/${id}/pin`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });

  const handleSubmit = () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.body.trim()) { setError('Body is required'); return; }
    const payload = {
      title: form.title,
      body: form.body,
      targetType: form.targetType,
      departmentId: form.targetType === 'DEPARTMENT' ? form.departmentId || undefined : undefined,
      isPinned: form.isPinned,
      expiresAt: form.expiresAt || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  };
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconSpeakerphone size={22} color="var(--color-primary)" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Announcements</h1>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>Company-wide and department notices</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={openNew}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            <IconPlus size={16} /> New Announcement
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : (announcements || []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
          <IconSpeakerphone size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
          <div>No announcements yet.</div>
          {isAdmin && <div style={{ fontSize: 13, marginTop: 4 }}>Click "New Announcement" to post one.</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(announcements || []).map((a: any) => (
            <div key={a.id} style={{
              background: 'var(--color-surface)',
              border: `1px solid ${a.isPinned ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 12,
              padding: '18px 20px',
              position: 'relative',
            }}>
              {a.isPinned && (
                <span style={{ position: 'absolute', top: 12, right: isAdmin ? 76 : 12, fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', background: '#eff6ff', padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <IconPin size={10} /> Pinned
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: 'var(--color-text)', paddingRight: a.isPinned ? 80 : 0 }}>{a.title}</div>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{a.body}</p>
                  <div style={{ marginTop: 12, display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    <span>{timeAgo(a.createdAt)}</span>
                    {a.targetType === 'DEPARTMENT' && a.departmentName && (
                      <span style={{ background: '#fef3c7', color: '#92400e', padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>
                        {a.departmentName}
                      </span>
                    )}
                    {a.targetType === 'ALL' && (
                      <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>
                        All Staff
                      </span>
                    )}
                    {a.expiresAt && (
                      <span>Expires {new Date(a.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => pinMutation.mutate(a.id)}
                      title={a.isPinned ? 'Unpin' : 'Pin'}
                      style={{ padding: 6, borderRadius: 7, border: '1px solid var(--color-border)', background: a.isPinned ? '#eff6ff' : 'none', cursor: 'pointer', color: a.isPinned ? 'var(--color-primary)' : 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
                      <IconPin size={14} />
                    </button>
                    <button
                      onClick={() => openEdit(a)}
                      title="Edit"
                      style={{ padding: 6, borderRadius: 7, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
                      <IconPencil size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this announcement?')) deleteMutation.mutate(a.id); }}
                      title="Delete"
                      style={{ padding: 6, borderRadius: 7, border: '1px solid #fecaca', background: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center' }}>
                      <IconTrash size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 520 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{editingId ? 'Edit Announcement' : 'New Announcement'}</div>
              <button onClick={() => { setShowModal(false); setEditingId(null); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                <IconX size={18} />
              </button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Title *</label>
                <input style={inputStyle} placeholder="e.g. Office will be closed on Republic Day" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Message *</label>
                <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} placeholder="Announcement details..." value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Audience</label>
                  <select style={inputStyle} value={form.targetType} onChange={e => setForm(f => ({ ...f, targetType: e.target.value }))}>
                    <option value="ALL">All Staff</option>
                    <option value="DEPARTMENT">Specific Department</option>
                  </select>
                </div>
                {form.targetType === 'DEPARTMENT' && (
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Department</label>
                    <select style={inputStyle} value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}>
                      <option value="">Select...</option>
                      {(depts || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Expires On (optional)</label>
                  <input type="date" style={inputStyle} value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.isPinned} onChange={e => setForm(f => ({ ...f, isPinned: e.target.checked }))} />
                Pin to top
              </label>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowModal(false); setEditingId(null); setError(''); }} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
                <button onClick={handleSubmit} disabled={isSaving}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                  {isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Post Announcement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
