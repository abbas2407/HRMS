import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../../../lib/api';
import { IconPlus, IconClock, IconUsers, IconEdit, IconTrash } from '@tabler/icons-react';

const shiftSchema = z.object({
  name: z.string().min(1, 'Name required'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM format'),
  graceMinutes: z.number().int().min(0).max(60).default(10),
  isNightShift: z.boolean().default(false),
});
type ShiftForm = z.infer<typeof shiftSchema>;

export default function ShiftsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => api.get('/shifts').then(r => r.data.data),
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { graceMinutes: 10, isNightShift: false },
  });

  const saveMutation = useMutation({
    mutationFn: (body: ShiftForm) =>
      editing
        ? api.put(`/shifts/${editing.id}`, body)
        : api.post('/shifts', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/shifts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });

  function openCreate() {
    setEditing(null);
    reset({ graceMinutes: 10, isNightShift: false });
    setShowModal(true);
  }

  function openEdit(shift: any) {
    setEditing(shift);
    reset({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      graceMinutes: shift.graceMinutes ?? 10,
      isNightShift: shift.isNightShift ?? false,
    });
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditing(null); reset(); }

  const onSubmit = (data: ShiftForm) => saveMutation.mutate(data);

  if (isLoading) return <div style={{ padding: 24 }}>Loading shifts...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Shifts</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)' }}>Manage work shifts and timings</p>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          <IconPlus size={16} /> Add Shift
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {(data || []).map((shift: any) => (
          <div key={shift.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{shift.name}</div>
                {shift.isNightShift && (
                  <span style={{ fontSize: 11, background: '#1e3a5f', color: '#93c5fd', padding: '2px 8px', borderRadius: 12, marginBottom: 8, display: 'inline-block' }}>Night Shift</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(shift)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                  <IconEdit size={16} />
                </button>
                <button onClick={() => deleteMutation.mutate(shift.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                  <IconTrash size={16} />
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 8px', color: 'var(--color-text-secondary)', fontSize: 14 }}>
              <IconClock size={14} />
              {shift.startTime} â€“ {shift.endTime}
              <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>({shift.graceMinutes ?? 10}m grace)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)', fontSize: 13 }}>
              <IconUsers size={13} />
              {shift.assignedCount ?? 0} employees
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 28, width: 420 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{editing ? 'Edit Shift' : 'Create Shift'}</h3>
            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Shift Name</label>
                <input {...register('name')} placeholder="e.g. Morning Shift" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                {errors.name && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.name.message}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Start Time</label>
                  <input {...register('startTime')} type="time" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                  {errors.startTime && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.startTime.message}</span>}
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>End Time</label>
                  <input {...register('endTime')} type="time" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                  {errors.endTime && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.endTime.message}</span>}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Grace Period (minutes)</label>
                <input {...register('graceMinutes', { valueAsNumber: true })} type="number" min={0} max={60} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input {...register('isNightShift')} type="checkbox" />
                Night Shift (crosses midnight)
              </label>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={closeModal} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
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

