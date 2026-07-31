import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { IconPlus } from '@tabler/icons-react';

function BalanceBar({ consumed, tentative, balance }: { consumed: number; tentative: number; balance: number }) {
  const total = consumed + tentative + balance;
  if (total === 0) return <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3 }} />;
  const consumedPct = Math.round((consumed / total) * 100);
  const tentativePct = Math.round((tentative / total) * 100);
  const balancePct = 100 - consumedPct - tentativePct;
  return (
    <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex', gap: 0 }}>
      <div style={{ width: `${consumedPct}%`, background: '#ef4444' }} />
      <div style={{ width: `${tentativePct}%`, background: '#f59e0b' }} />
      <div style={{ width: `${balancePct}%`, background: '#22c55e' }} />
    </div>
  );
}

export default function LeaveBalancePage() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  const isHR = role === 'HR_ADMIN';
  const year = new Date().getFullYear();
  const [creditModal, setCreditModal] = useState(false);
  const [creditForm, setCreditForm] = useState({ employeeId: '', leaveTypeId: '', year, days: 1 });
  const [creditError, setCreditError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['leave-balance', year],
    queryFn: () => api.get(`/leave/balance?year=${year}`).then(r => r.data.data),
  });

  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => api.get('/leave/types').then(r => r.data.data),
    enabled: isHR,
  });

  const creditMutation = useMutation({
    mutationFn: () => api.post('/leave/balance/credit', { ...creditForm, days: Number(creditForm.days), year: Number(creditForm.year) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-balance'] }); setCreditModal(false); setCreditError(''); },
    onError: (e: any) => setCreditError(e?.response?.data?.error || 'Failed to credit leave'),
  });

  const balances: any[] = data || [];
  const activeTypes: any[] = (leaveTypes || []).filter((lt: any) => lt.isActive);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Leave Balance</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>Your leave entitlements for {year}</p>
        </div>
        {isHR && (
          <button onClick={() => setCreditModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            <IconPlus size={16} /> Credit Leave
          </button>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {[
          { color: '#22c55e', label: 'Available' },
          { color: '#f59e0b', label: 'Pending/Tentative' },
          { color: '#ef4444', label: 'Consumed' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: l.color, display: 'inline-block' }} />
            {l.label}
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : balances.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)', background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
          No leave balances found for {year}. Contact HR to set up your leave entitlements.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {balances.map((b: any) => {
            const avail = parseFloat(b.balance ?? '0') - parseFloat(b.tentative ?? '0');
            const consumed = parseFloat(b.consumed ?? '0');
            const tentative = parseFloat(b.tentative ?? '0');
            const balance = parseFloat(b.balance ?? '0');
            return (
              <div key={b.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{b.typeName}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#eff6ff', color: '#1d4ed8' }}>{b.typeCode}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: avail > 0 ? '#22c55e' : '#ef4444', lineHeight: 1 }}>
                      {avail.toFixed(1)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>available</div>
                  </div>
                </div>
                <BalanceBar consumed={consumed} tentative={tentative} balance={Math.max(0, avail)} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12, textAlign: 'center' }}>
                  {[
                    { label: 'Total', value: balance.toFixed(1), color: 'var(--color-text)' },
                    { label: 'Used', value: consumed.toFixed(1), color: '#ef4444' },
                    { label: 'Pending', value: tentative.toFixed(1), color: '#f59e0b' },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {b.maxDaysPerYear && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    Max {b.maxDaysPerYear} days/year · {b.isPaid ? 'Paid' : 'Unpaid'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {creditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 28, width: 400 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Credit Leave Days</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Employee ID</label>
                <input value={creditForm.employeeId} onChange={e => setCreditForm(f => ({ ...f, employeeId: e.target.value }))} placeholder="Employee UUID"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Leave Type</label>
                <select value={creditForm.leaveTypeId} onChange={e => setCreditForm(f => ({ ...f, leaveTypeId: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }}>
                  <option value="">Select...</option>
                  {activeTypes.map((lt: any) => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Year</label>
                  <input type="number" value={creditForm.year} onChange={e => setCreditForm(f => ({ ...f, year: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Days</label>
                  <input type="number" min={0.5} step={0.5} value={creditForm.days} onChange={e => setCreditForm(f => ({ ...f, days: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                </div>
              </div>
              {creditError && <div style={{ color: '#ef4444', fontSize: 13 }}>{creditError}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setCreditModal(false); setCreditError(''); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)', fontSize: 13 }}>Cancel</button>
                <button onClick={() => creditMutation.mutate()} disabled={creditMutation.isPending || !creditForm.employeeId || !creditForm.leaveTypeId}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  {creditMutation.isPending ? 'Crediting...' : 'Credit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
