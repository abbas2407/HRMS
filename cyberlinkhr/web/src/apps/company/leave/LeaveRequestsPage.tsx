import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { IconPlus, IconCheck, IconX } from '@tabler/icons-react';

const createSchema = z.object({
  leaveTypeId: z.string().uuid('Select a leave type'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Required'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Required'),
  isHalfDay: z.boolean().default(false),
  halfDaySession: z.enum(['AM', 'PM']).optional(),
  reason: z.string().optional(),
});
type ReqForm = z.infer<typeof createSchema>;

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: '#fef9c3', color: '#854d0e' },
  APPROVED:  { bg: '#dcfce7', color: '#166534' },
  REJECTED:  { bg: '#fee2e2', color: '#991b1b' },
  CANCELLED: { bg: '#f1f5f9', color: '#64748b' },
};

export default function LeaveRequestsPage() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  const isHR = role === 'HR_ADMIN';
  const [showModal, setShowModal] = useState(false);
  const [reviewModal, setReviewModal] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [statusFilter, setStatusFilter] = useState(isHR ? 'PENDING' : '');
  const [error, setError] = useState('');

  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => api.get('/leave/types').then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['leave-requests', statusFilter],
    queryFn: () => api.get(`/leave/requests${statusFilter ? `?status=${statusFilter}` : ''}`).then(r => r.data.data),
  });

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<ReqForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { isHalfDay: false },
  });
  const isHalfDay = watch('isHalfDay');

  const createMutation = useMutation({
    mutationFn: (body: ReqForm) => api.post('/leave/requests', body).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-requests'] }); setShowModal(false); reset(); setError(''); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed to submit request'),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, action, comment }: { id: string; action: string; comment: string }) =>
      api.put(`/leave/requests/${id}/${action}`, { comment }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-requests'] }); setReviewModal(null); setReviewComment(''); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.put(`/leave/requests/${id}/cancel`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-requests'] }),
  });

  const rows: any[] = data || [];
  const activeTypes: any[] = (leaveTypes || []).filter((lt: any) => lt.isActive);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Leave Requests</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)' }}>
            {isHR ? 'Manage all employee leave requests' : 'Apply for leave and track your requests'}
          </p>
        </div>
        {!isHR && (
          <button onClick={() => { setShowModal(true); setError(''); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            <IconPlus size={16} /> Apply Leave
          </button>
        )}
      </div>

      {/* Status filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: '', label: 'All' },
          { key: 'PENDING', label: 'Pending' },
          { key: 'APPROVED', label: 'Approved' },
          { key: 'REJECTED', label: 'Rejected' },
          { key: 'CANCELLED', label: 'Cancelled' },
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

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {[...(isHR ? ['Employee'] : []), 'Leave Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
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
                  {isHR && (
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{row.firstName} {row.lastName}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{row.employeeCode}</div>
                    </td>
                  )}
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{row.leaveTypeName}</div>
                    <span style={{ fontSize: 11, color: row.isPaid ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>{row.isPaid ? 'Paid' : 'Unpaid'}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{row.startDate}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{row.endDate}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>
                    {row.isHalfDay ? `½ day (${row.halfDaySession})` : `${parseFloat(row.daysCount ?? '0')} day(s)`}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--color-text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.reason || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, background: sc?.bg, color: sc?.color, fontWeight: 600, fontSize: 12 }}>{row.status}</span>
                    {row.reviewComment && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{row.reviewComment}</div>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isHR && row.status === 'PENDING' && (
                        <>
                          <button onClick={() => setReviewModal({ id: row.id, action: 'approve' })}
                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                            <IconCheck size={12} />
                          </button>
                          <button onClick={() => setReviewModal({ id: row.id, action: 'reject' })}
                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                            <IconX size={12} />
                          </button>
                        </>
                      )}
                      {!isHR && ['PENDING', 'APPROVED'].includes(row.status) && (
                        <button onClick={() => cancelMutation.mutate(row.id)}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Apply leave modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 28, width: 460 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Apply for Leave</h3>
            <form onSubmit={handleSubmit(d => createMutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Leave Type *</label>
                <select {...register('leaveTypeId')} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }}>
                  <option value="">Select leave type...</option>
                  {activeTypes.map((lt: any) => (
                    <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>
                  ))}
                </select>
                {errors.leaveTypeId && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.leaveTypeId.message}</span>}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input {...register('isHalfDay')} type="checkbox" />
                Half Day
              </label>
              {isHalfDay && (
                <div style={{ display: 'flex', gap: 12 }}>
                  {['AM', 'PM'].map(s => (
                    <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input {...register('halfDaySession')} type="radio" value={s} />
                      {s === 'AM' ? 'First Half' : 'Second Half'}
                    </label>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>{isHalfDay ? 'Date' : 'From'} *</label>
                  <input type="date" {...register('startDate')} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                  {errors.startDate && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.startDate.message}</span>}
                </div>
                {!isHalfDay && (
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>To *</label>
                    <input type="date" {...register('endDate')} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                    {errors.endDate && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.endDate.message}</span>}
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Reason (optional)</label>
                <textarea {...register('reason')} rows={2} placeholder="Brief reason for leave..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowModal(false); reset(); setError(''); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)', fontSize: 13 }}>Cancel</button>
                <button type="submit" disabled={createMutation.isPending} style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
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
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{reviewModal.action === 'approve' ? 'Approve' : 'Reject'} Leave</h3>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Comment (optional)</label>
            <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={3}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box', resize: 'vertical', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setReviewModal(null); setReviewComment(''); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)', fontSize: 13 }}>Cancel</button>
              <button onClick={() => reviewMutation.mutate({ id: reviewModal.id, action: reviewModal.action, comment: reviewComment })}
                disabled={reviewMutation.isPending}
                style={{ padding: '8px 16px', borderRadius: 8, background: reviewModal.action === 'approve' ? '#22c55e' : '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                {reviewMutation.isPending ? 'Processing...' : reviewModal.action === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
