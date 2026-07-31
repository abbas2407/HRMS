import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { IconReceipt, IconPlus, IconX, IconTrash, IconEye, IconCheck, IconAlertCircle } from '@tabler/icons-react';

const CATEGORIES = ['TRAVEL', 'FOOD', 'ACCOMMODATION', 'COMMUNICATION', 'OFFICE_SUPPLIES', 'MEDICAL', 'OTHER'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: '#f1f5f9', text: '#64748b' },
  SUBMITTED: { bg: '#dbeafe', text: '#1e40af' },
  APPROVED: { bg: '#dcfce7', text: '#166534' },
  REJECTED: { bg: '#fee2e2', text: '#991b1b' },
  REIMBURSED: { bg: '#ede9fe', text: '#5b21b6' },
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
  color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box',
};

const emptyItem = () => ({ category: 'TRAVEL', description: '', amount: '', expenseDate: new Date().toISOString().split('T')[0] });

export default function ExpensesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'HR_ADMIN';
  const isManager = user?.role === 'MANAGER' || isAdmin;
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [viewClaim, setViewClaim] = useState<any>(null);
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [claimTitle, setClaimTitle] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [reviewForm, setReviewForm] = useState({ action: 'APPROVED', remarks: '' });
  const [error, setError] = useState('');

  const { data: claims, isLoading } = useQuery<any[]>({
    queryKey: ['expense-claims'],
    queryFn: () => api.get('/expenses').then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/expenses', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-claims'] }); setShowCreate(false); setClaimTitle(''); setItems([emptyItem()]); setError(''); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/expenses/${id}/submit`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-claims'] }); setViewClaim(null); },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, body }: any) => api.patch(`/expenses/${id}/review`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-claims'] }); setReviewTarget(null); setError(''); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const reimburseMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/expenses/${id}/reimburse`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense-claims'] }),
  });

  const openView = async (id: string) => {
    const res = await api.get(`/expenses/${id}`);
    setViewClaim(res.data.data);
  };

  const updateItem = (i: number, field: string, value: string) =>
    setItems(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: value }; return n; });

  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  const pending = (claims || []).filter(c => c.status === 'SUBMITTED').length;

  return (
    <div style={{ padding: 24, maxWidth: 1050, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconReceipt size={22} color="var(--color-primary)" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Expense Claims</h1>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>Submit and track reimbursable expenses</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isManager && pending > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fef3c7', color: '#92400e', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              <IconAlertCircle size={14} /> {pending} pending review
            </div>
          )}
          <button onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            <IconPlus size={16} /> New Claim
          </button>
        </div>
      </div>

      {isLoading ? <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div> :
        !(claims || []).length ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
            <IconReceipt size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
            No expense claims yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-surface)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
                  {[isManager && 'Employee', 'Title', 'Amount', 'Status', 'Submitted', 'Actions'].filter(Boolean).map(h => (
                    <th key={h as string} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(claims || []).map((c: any) => {
                  const sc = STATUS_COLORS[c.status] || STATUS_COLORS.DRAFT;
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {isManager && (
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{c.employeeName}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{c.employeeCode}</div>
                        </td>
                      )}
                      <td style={{ padding: '11px 14px', fontWeight: 600 }}>{c.title}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 700, color: '#059669' }}>₹{Number(c.totalAmount).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ background: sc.bg, color: sc.text, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{c.status}</span>
                      </td>
                      <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)', fontSize: 12 }}>
                        {c.submittedAt ? new Date(c.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openView(c.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 12 }}>
                            <IconEye size={12} /> View
                          </button>
                          {c.status === 'DRAFT' && (
                            <button onClick={() => submitMutation.mutate(c.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, border: '1px solid #bfdbfe', background: 'none', cursor: 'pointer', fontSize: 12, color: '#1d4ed8' }}>
                              Submit
                            </button>
                          )}
                          {isManager && c.status === 'SUBMITTED' && (
                            <button onClick={() => { setReviewTarget(c); setReviewForm({ action: 'APPROVED', remarks: '' }); setError(''); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, border: '1px solid #bbf7d0', background: 'none', cursor: 'pointer', fontSize: 12, color: '#166534' }}>
                              <IconCheck size={12} /> Review
                            </button>
                          )}
                          {isAdmin && c.status === 'APPROVED' && (
                            <button onClick={() => reimburseMutation.mutate(c.id)}
                              style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #c4b5fd', background: 'none', cursor: 'pointer', fontSize: 12, color: '#5b21b6' }}>
                              Reimburse
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
        )}

      {/* Create claim modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>New Expense Claim</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Claim Title *</label>
                <input style={inputStyle} placeholder="e.g. Mumbai Client Visit - April" value={claimTitle} onChange={e => setClaimTitle(e.target.value)} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Expense Items *</label>
                  <button onClick={() => setItems(p => [...p, emptyItem()])}
                    style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <IconPlus size={13} /> Add Item
                  </button>
                </div>
                {items.map((item, i) => (
                  <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Category</label>
                        <select style={inputStyle} value={item.category} onChange={e => updateItem(i, 'category', e.target.value)}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date</label>
                        <input type="date" style={inputStyle} value={item.expenseDate} onChange={e => updateItem(i, 'expenseDate', e.target.value)} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
                        <input style={inputStyle} placeholder="What was this for?" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Amount (₹)</label>
                        <input type="number" style={{ ...inputStyle, width: 120 }} value={item.amount} onChange={e => updateItem(i, 'amount', e.target.value)} />
                      </div>
                    </div>
                    {items.length > 1 && (
                      <button onClick={() => setItems(p => p.filter((_, j) => j !== i))}
                        style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: '1px solid #fecaca', background: 'none', cursor: 'pointer', fontSize: 11, color: '#dc2626' }}>
                        <IconTrash size={11} /> Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--color-background)', borderRadius: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCreate(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => createMutation.mutate({ title: claimTitle, items: items.map(i => ({ ...i, amount: parseFloat(i.amount) })) })} disabled={createMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {createMutation.isPending ? 'Saving...' : 'Save as Draft'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View claim modal */}
      {viewClaim && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{viewClaim.title}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{viewClaim.employeeName}</div>
              </div>
              <button onClick={() => setViewClaim(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                    {['Date', 'Category', 'Description', 'Amount'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, fontSize: 11, color: 'var(--color-text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(viewClaim.items || []).map((item: any) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px' }}>{item.expenseDate}</td>
                      <td style={{ padding: '8px' }}>{item.category.replace('_', ' ')}</td>
                      <td style={{ padding: '8px' }}>{item.description}</td>
                      <td style={{ padding: '8px', fontWeight: 600 }}>₹{Number(item.amount).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--color-border)' }}>
                    <td colSpan={3} style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>Total</td>
                    <td style={{ padding: '10px 8px', fontWeight: 800, color: '#059669', fontSize: 16 }}>₹{Number(viewClaim.totalAmount).toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
              {viewClaim.remarks && (
                <div style={{ background: viewClaim.status === 'REJECTED' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${viewClaim.status === 'REJECTED' ? '#fecaca' : '#bbf7d0'}`, borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Reviewer Remarks</div>
                  <div style={{ fontSize: 13 }}>{viewClaim.remarks}</div>
                </div>
              )}
              {viewClaim.status === 'DRAFT' && (
                <div style={{ marginTop: 16 }}>
                  <button onClick={() => { submitMutation.mutate(viewClaim.id); }}
                    style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                    Submit for Approval
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 420 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Review Claim</div>
              <button onClick={() => setReviewTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--color-background)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700 }}>{reviewTarget.title}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{reviewTarget.employeeName}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#059669', marginTop: 6 }}>₹{Number(reviewTarget.totalAmount).toLocaleString('en-IN')}</div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Decision *</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {['APPROVED', 'REJECTED'].map(a => (
                    <button key={a} onClick={() => setReviewForm(f => ({ ...f, action: a }))}
                      style={{ flex: 1, padding: '9px', borderRadius: 9, border: `2px solid ${reviewForm.action === a ? (a === 'APPROVED' ? '#22c55e' : '#ef4444') : 'var(--color-border)'}`, background: reviewForm.action === a ? (a === 'APPROVED' ? '#dcfce7' : '#fee2e2') : 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: reviewForm.action === a ? (a === 'APPROVED' ? '#166534' : '#991b1b') : 'var(--color-text)' }}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Remarks</label>
                <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={reviewForm.remarks} onChange={e => setReviewForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setReviewTarget(null)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => reviewMutation.mutate({ id: reviewTarget.id, body: reviewForm })} disabled={reviewMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {reviewMutation.isPending ? 'Saving...' : 'Submit Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
