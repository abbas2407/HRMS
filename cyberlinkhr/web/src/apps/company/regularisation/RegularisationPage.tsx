import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { IconPlus, IconCheck, IconX } from '@tabler/icons-react';

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Required'),
  requestedIn: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  requestedOut: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  reason: z.string().min(5, 'Minimum 5 characters'),
});
type RegForm = z.infer<typeof createSchema>;

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:  { bg: '#fef9c3', color: '#854d0e' },
  APPROVED: { bg: '#dcfce7', color: '#166534' },
  REJECTED: { bg: '#fee2e2', color: '#991b1b' },
};

export default function RegularisationPage() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  const isHR = role === 'HR_ADMIN';
  const [showModal, setShowModal] = useState(false);
  const [reviewModal, setReviewModal] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');

  const { data, isLoading } = useQuery({
    queryKey: ['regularisation', statusFilter],
    queryFn: () => api.get(`/regularisation${statusFilter ? `?status=${statusFilter}` : ''}`).then(r => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RegForm>({ resolver: zodResolver(createSchema) });

  const createMutation = useMutation({
    mutationFn: (body: RegForm) => api.post('/regularisation', body).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['regularisation'] }); setShowModal(false); reset(); },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, action, comment }: { id: string; action: string; comment: string }) =>
      api.put(`/regularisation/${id}/${action}`, { comment }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['regularisation'] }); setReviewModal(null); setReviewComment(''); },
  });

  const rows: any[] = data || [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Attendance Regularisation</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)' }}>
            {isHR ? 'Review employee regularisation requests' : 'Request corrections for missed punches'}
          </p>
        </div>
        {!isHR && (
          <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            <IconPlus size={16} /> New Request
          </button>
        )}
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'PENDING', label: 'Pending' },
          { key: 'APPROVED', label: 'Approved' },
          { key: 'REJECTED', label: 'Rejected' },
          { key: '', label: 'All' },
        ].map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              borderColor: statusFilter === f.key ? 'var(--color-primary)' : 'var(--color-border)',
              background: statusFilter === f.key ? 'var(--color-primary)' : 'var(--color-surface)',
              color: statusFilter === f.key ? '#fff' : 'var(--color-text)',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Date', ...(isHR ? ['Employee'] : []), 'Req. In', 'Req. Out', 'Reason', 'Status', 'Comment', ...(isHR && statusFilter === 'PENDING' ? ['Actions'] : [])].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No requests found</td></tr>
            ) : rows.map((row: any) => {
              const sc = STATUS_STYLE[row.status];
              return (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{row.date}</td>
                  {isHR && (
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{row.firstName} {row.lastName}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{row.employeeCode}</div>
                    </td>
                  )}
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{row.requestedIn || '--'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{row.requestedOut || '--'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.reason}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, background: sc?.bg, color: sc?.color, fontWeight: 600, fontSize: 12 }}>{row.status}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--color-text-secondary)' }}>{row.reviewComment || '--'}</td>
                  {isHR && statusFilter === 'PENDING' && (
                    <td style={{ padding: '10px 14px' }}>
                      {row.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setReviewModal({ id: row.id, action: 'approve' })}
                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                            <IconCheck size={12} />
                          </button>
                          <button onClick={() => setReviewModal({ id: row.id, action: 'reject' })}
                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                            <IconX size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 28, width: 440 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Request Regularisation</h3>
            <form onSubmit={handleSubmit(d => createMutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date</label>
                <input type="date" {...register('date')} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                {errors.date && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.date.message}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Requested In (optional)</label>
                  <input type="time" {...register('requestedIn')} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Requested Out (optional)</label>
                  <input type="time" {...register('requestedOut')} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Reason</label>
                <textarea {...register('reason')} placeholder="Explain why you need this correction..." rows={3}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box', resize: 'vertical' }} />
                {errors.reason && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.reason.message}</span>}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowModal(false); reset(); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>Cancel</button>
                <button type="submit" disabled={createMutation.isPending} style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {createMutation.isPending ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 28, width: 380 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{reviewModal.action === 'approve' ? 'Approve' : 'Reject'} Request</h3>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Comment (optional)</label>
            <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={3}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box', resize: 'vertical', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setReviewModal(null); setReviewComment(''); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>Cancel</button>
              <button onClick={() => reviewMutation.mutate({ id: reviewModal.id, action: reviewModal.action, comment: reviewComment })}
                disabled={reviewMutation.isPending}
                style={{ padding: '8px 16px', borderRadius: 8, background: reviewModal.action === 'approve' ? '#22c55e' : '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {reviewMutation.isPending ? 'Processing...' : reviewModal.action === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

