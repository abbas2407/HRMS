import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';

interface Structure {
  id: string;
  name: string;
  basicPct: string;
  hraPct: string;
  specialPct: string;
  isActive: boolean;
  createdAt: string;
}

const defaultForm = { name: '', basicPct: 50, hraPct: 20, specialPct: 30 };

export default function SalaryStructurePage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Structure | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery<Structure[]>({
    queryKey: ['salary-structures'],
    queryFn: () => api.get('/payroll/structures').then(r => r.data.data),
  });

  const saveMutation = useMutation({
    mutationFn: () => editing
      ? api.put(`/payroll/structures/${editing.id}`, form).then(r => r.data)
      : api.post('/payroll/structures', form).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary-structures'] }); closeModal(); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll/structures/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-structures'] }),
    onError: (e: any) => alert(e?.response?.data?.error || 'Cannot delete'),
  });

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setError('');
    setModal(true);
  }

  function openEdit(s: Structure) {
    setEditing(s);
    setForm({ name: s.name, basicPct: parseFloat(s.basicPct), hraPct: parseFloat(s.hraPct), specialPct: parseFloat(s.specialPct) });
    setError('');
    setModal(true);
  }

  function closeModal() { setModal(false); setEditing(null); setError(''); }

  const total = form.basicPct + form.hraPct + form.specialPct;

  const structures: Structure[] = data || [];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Salary Structures</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>Define how gross salary is split into components</p>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          <IconPlus size={16} /> Add Structure
        </button>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : structures.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)', background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
          No salary structures. Create one to assign to employees.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {structures.map((s) => (
            <div key={s.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: s.isActive ? '#dcfce7' : '#f3f4f6', color: s.isActive ? '#15803d' : '#6b7280', fontWeight: 600 }}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(s)} style={{ padding: 6, border: '1px solid var(--color-border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                    <IconEdit size={14} />
                  </button>
                  <button onClick={() => { if (confirm('Delete this structure?')) deleteMutation.mutate(s.id); }} style={{ padding: 6, border: '1px solid #fecaca', borderRadius: 6, background: 'none', cursor: 'pointer', color: '#ef4444' }}>
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>

              {/* Visual split bar */}
              <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 10 }}>
                <div style={{ width: `${s.basicPct}%`, background: '#3b82f6' }} />
                <div style={{ width: `${s.hraPct}%`, background: '#10b981' }} />
                <div style={{ width: `${s.specialPct}%`, background: '#f59e0b' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                {[
                  { label: 'Basic', pct: s.basicPct, color: '#3b82f6' },
                  { label: 'HRA', pct: s.hraPct, color: '#10b981' },
                  { label: 'Special', pct: s.specialPct, color: '#f59e0b' },
                ].map(c => (
                  <div key={c.label}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{parseFloat(c.pct).toFixed(0)}%</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{c.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 28, width: 420 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{editing ? 'Edit' : 'New'} Salary Structure</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Standard, Senior"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {([['basicPct', 'Basic %'], ['hraPct', 'HRA %'], ['specialPct', 'Special %']] as [keyof typeof form, string][]).map(([key, label]) => (
                  <div key={key}>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                    <input type="number" min={0} max={100} step={1} value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', fontSize: 13, color: total === 100 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                Total: {total}% {total === 100 ? '✓' : '(must be 100%)'}
              </div>

              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={closeModal} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)', fontSize: 13 }}>Cancel</button>
                <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || total !== 100 || !form.name.trim()}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
