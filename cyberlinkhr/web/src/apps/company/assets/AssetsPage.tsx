import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { IconPackage, IconPlus, IconX, IconCheck, IconArrowBack } from '@tabler/icons-react';

const CATEGORIES = ['LAPTOP', 'PHONE', 'HEADSET', 'MONITOR', 'VEHICLE', 'FURNITURE', 'OTHER'];
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  AVAILABLE: { bg: '#dcfce7', text: '#166534' },
  ASSIGNED: { bg: '#dbeafe', text: '#1e40af' },
  UNDER_REPAIR: { bg: '#fef3c7', text: '#92400e' },
  SCRAPPED: { bg: '#fee2e2', text: '#991b1b' },
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
  color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box',
};

export default function AssetsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [returnTarget, setReturnTarget] = useState<any>(null);
  const [form, setForm] = useState({ name: '', category: 'LAPTOP', brand: '', serialNumber: '', purchaseDate: '', purchaseValue: '', notes: '' });
  const [assignForm, setAssignForm] = useState({ employeeId: '', assignedAt: new Date().toISOString().split('T')[0], remarks: '' });
  const [returnForm, setReturnForm] = useState({ returnedAt: new Date().toISOString().split('T')[0], condition: 'GOOD', remarks: '' });
  const [error, setError] = useState('');

  const { data: assetList, isLoading } = useQuery<any[]>({
    queryKey: ['assets'],
    queryFn: () => api.get('/assets').then(r => r.data.data),
  });

  const { data: employees } = useQuery<any[]>({
    queryKey: ['employees-list'],
    queryFn: () => api.get('/employees').then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/assets', body).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setShowCreate(false); setForm({ name: '', category: 'LAPTOP', brand: '', serialNumber: '', purchaseDate: '', purchaseValue: '', notes: '' }); setError(''); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, body }: any) => api.post(`/assets/${id}/assign`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setAssignTarget(null); setAssignForm({ employeeId: '', assignedAt: new Date().toISOString().split('T')[0], remarks: '' }); setError(''); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const returnMutation = useMutation({
    mutationFn: ({ id, body }: any) => api.post(`/assets/${id}/return`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setReturnTarget(null); setError(''); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const available = (assetList || []).filter(a => a.status === 'AVAILABLE').length;
  const assigned = (assetList || []).filter(a => a.status === 'ASSIGNED').length;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconPackage size={22} color="var(--color-primary)" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Asset Management</h1>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>Track company assets assigned to employees</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          <IconPlus size={16} /> Add Asset
        </button>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: (assetList || []).length, bg: 'var(--color-surface)', text: 'var(--color-text)' },
          { label: 'Available', value: available, bg: '#dcfce7', text: '#166534' },
          { label: 'Assigned', value: assigned, bg: '#dbeafe', text: '#1e40af' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 18px', minWidth: 80 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.text }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : (assetList || []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
          <IconPackage size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
          No assets yet. Add your first asset.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
                {['Code', 'Asset', 'Category', 'Brand / Serial', 'Status', 'Assigned To', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(assetList || []).map((a: any) => {
                const sc = STATUS_COLORS[a.status] || STATUS_COLORS.AVAILABLE;
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12 }}>{a.assetCode}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 600 }}>{a.name}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)', fontSize: 12 }}>{a.category}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)', fontSize: 12 }}>
                      {a.brand || '—'}{a.serialNumber ? <><br /><span style={{ fontFamily: 'monospace' }}>{a.serialNumber}</span></> : ''}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: sc.bg, color: sc.text, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{a.status}</span>
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)' }}>
                      {a.assignedToName || <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {a.status === 'AVAILABLE' && (
                          <button onClick={() => { setAssignTarget(a); setError(''); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, border: '1px solid #bfdbfe', background: 'none', cursor: 'pointer', fontSize: 12, color: '#1d4ed8' }}>
                            <IconCheck size={12} /> Assign
                          </button>
                        )}
                        {a.status === 'ASSIGNED' && (
                          <button onClick={() => { setReturnTarget(a); setError(''); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, border: '1px solid #fde68a', background: 'none', cursor: 'pointer', fontSize: 12, color: '#92400e' }}>
                            <IconArrowBack size={12} /> Return
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

      {/* Add asset modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Add Asset</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Asset Name *</label>
                <input style={inputStyle} placeholder="e.g. MacBook Pro 14" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Category *</label>
                  <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Brand</label>
                  <input style={inputStyle} placeholder="Apple, Dell..." value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Serial Number</label>
                  <input style={inputStyle} placeholder="S/N..." value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Purchase Value (₹)</label>
                  <input type="number" style={inputStyle} value={form.purchaseValue} onChange={e => setForm(f => ({ ...f, purchaseValue: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Purchase Date</label>
                  <input type="date" style={inputStyle} value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCreate(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => createMutation.mutate({ ...form, purchaseValue: form.purchaseValue ? Number(form.purchaseValue) : undefined })} disabled={createMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {createMutation.isPending ? 'Adding...' : 'Add Asset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assignTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 420 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Assign — {assignTarget.name}</div>
              <button onClick={() => setAssignTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Assign To *</label>
                <select style={inputStyle} value={assignForm.employeeId} onChange={e => setAssignForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">Select employee...</option>
                  {(employees || []).map((e: any) => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Date</label>
                <input type="date" style={inputStyle} value={assignForm.assignedAt} onChange={e => setAssignForm(f => ({ ...f, assignedAt: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Remarks</label>
                <input style={inputStyle} placeholder="Optional note..." value={assignForm.remarks} onChange={e => setAssignForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setAssignTarget(null)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => assignMutation.mutate({ id: assignTarget.id, body: assignForm })} disabled={assignMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return modal */}
      {returnTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 420 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Return — {returnTarget.name}</div>
              <button onClick={() => setReturnTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Return Date</label>
                <input type="date" style={inputStyle} value={returnForm.returnedAt} onChange={e => setReturnForm(f => ({ ...f, returnedAt: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Condition</label>
                <select style={inputStyle} value={returnForm.condition} onChange={e => setReturnForm(f => ({ ...f, condition: e.target.value }))}>
                  <option value="GOOD">Good</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Remarks</label>
                <input style={inputStyle} placeholder="Optional note..." value={returnForm.remarks} onChange={e => setReturnForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setReturnTarget(null)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => returnMutation.mutate({ id: returnTarget.id, body: returnForm })} disabled={returnMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: '#f59e0b', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {returnMutation.isPending ? 'Processing...' : 'Mark Returned'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
