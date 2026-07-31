import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../../../lib/api';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  code: z.string().min(1, 'Required').max(20),
  maxDaysPerYear: z.number().int().min(0).optional().or(z.literal('')),
  minNoticeDays: z.number().int().min(0).default(0),
  accrualPerMonth: z.number().min(0).default(0),
  carryForwardCap: z.number().int().min(0).optional().or(z.literal('')),
  isPaid: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
  isActive: z.boolean().default(true),
});
type LTForm = z.infer<typeof schema>;

export default function LeaveTypesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => api.get('/leave/types').then(r => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LTForm>({
    resolver: zodResolver(schema),
    defaultValues: { minNoticeDays: 0, accrualPerMonth: 0, isPaid: true, requiresApproval: true, isActive: true },
  });

  const saveMutation = useMutation({
    mutationFn: (body: LTForm) => {
      const clean = {
        ...body,
        maxDaysPerYear: body.maxDaysPerYear === '' ? undefined : Number(body.maxDaysPerYear),
        carryForwardCap: body.carryForwardCap === '' ? undefined : Number(body.carryForwardCap),
        code: String(body.code).toUpperCase(),
      };
      return editing ? api.put(`/leave/types/${editing.id}`, clean) : api.post('/leave/types', clean);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-types'] }); close(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leave/types/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-types'] }),
  });

  function open(lt?: any) {
    setEditing(lt ?? null);
    reset(lt ? {
      name: lt.name, code: lt.code,
      maxDaysPerYear: lt.maxDaysPerYear ?? '',
      minNoticeDays: lt.minNoticeDays ?? 0,
      accrualPerMonth: parseFloat(lt.accrualPerMonth ?? '0'),
      carryForwardCap: lt.carryForwardCap ?? '',
      isPaid: lt.isPaid ?? true,
      requiresApproval: lt.requiresApproval ?? true,
      isActive: lt.isActive ?? true,
    } : { minNoticeDays: 0, accrualPerMonth: 0, isPaid: true, requiresApproval: true, isActive: true });
    setShowModal(true);
  }

  function close() { setShowModal(false); setEditing(null); reset(); }

  const types: any[] = data || [];

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Leave Types</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>Configure leave policies for your company</p>
        </div>
        <button onClick={() => open()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          <IconPlus size={16} /> Add Leave Type
        </button>
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Name', 'Code', 'Max Days/Year', 'Accrual/Month', 'Notice', 'Carry Fwd Cap', 'Paid', 'Approval', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</td></tr>
            ) : types.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No leave types configured</td></tr>
            ) : types.map((lt: any) => (
              <tr key={lt.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{lt.name}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{lt.code}</span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{lt.maxDaysPerYear ?? '∞'}</td>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{parseFloat(lt.accrualPerMonth ?? '0') > 0 ? `${lt.accrualPerMonth}/mo` : '—'}</td>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{lt.minNoticeDays ?? 0}d</td>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{lt.carryForwardCap ?? '∞'}</td>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>
                  <span style={{ color: lt.isPaid ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{lt.isPaid ? 'Paid' : 'Unpaid'}</span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{lt.requiresApproval ? 'Yes' : 'Auto'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: lt.isActive ? '#dcfce7' : '#f1f5f9', color: lt.isActive ? '#166534' : '#64748b' }}>
                    {lt.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => open(lt)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}><IconEdit size={15} /></button>
                    <button onClick={() => deleteMutation.mutate(lt.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}><IconTrash size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 28, width: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{editing ? 'Edit' : 'Create'} Leave Type</h3>
            <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Name *</label>
                  <input {...register('name')} placeholder="e.g. Casual Leave" style={inp} />
                  {errors.name && <span style={err}>{errors.name.message}</span>}
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Code *</label>
                  <input {...register('code')} placeholder="e.g. CL" style={{ ...inp, textTransform: 'uppercase' }} />
                  {errors.code && <span style={err}>{errors.code.message}</span>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Max Days/Year</label>
                  <input {...register('maxDaysPerYear', { valueAsNumber: true })} type="number" min={0} placeholder="Leave blank for unlimited" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Accrual/Month</label>
                  <input {...register('accrualPerMonth', { valueAsNumber: true })} type="number" min={0} step={0.5} style={inp} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Min Notice (days)</label>
                  <input {...register('minNoticeDays', { valueAsNumber: true })} type="number" min={0} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Carry Forward Cap</label>
                  <input {...register('carryForwardCap', { valueAsNumber: true })} type="number" min={0} placeholder="Leave blank for unlimited" style={inp} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {[
                  { name: 'isPaid', label: 'Paid Leave' },
                  { name: 'requiresApproval', label: 'Requires Approval' },
                  { name: 'isActive', label: 'Active' },
                ].map(f => (
                  <label key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input {...register(f.name as any)} type="checkbox" />
                    {f.label}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={close} style={cancelBtn}>Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} style={primaryBtn}>
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box', fontSize: 13 };
const err: React.CSSProperties = { color: '#ef4444', fontSize: 12 };
const cancelBtn: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)', fontSize: 13 };
const primaryBtn: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 };
