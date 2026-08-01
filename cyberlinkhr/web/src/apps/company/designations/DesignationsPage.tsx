import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { IconPlus, IconPencil, IconTrash } from '@tabler/icons-react';

const schema = z.object({
  name: z.string().min(1, 'Name required').max(200),
  grade: z.string().max(50).optional(),
  level: z.coerce.number().int().min(1).optional(),
});
type Form = z.infer<typeof schema>;

export default function DesignationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['designations'],
    queryFn: () => api.get('/designations').then(r => r.data.data),
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<Form>({ resolver: zodResolver(schema) });

  function openCreate() {
    setEditing(null);
    reset({ name: '', grade: '', level: undefined });
    setOpen(true);
  }

  function openEdit(d: any) {
    setEditing(d);
    setValue('name', d.name);
    setValue('grade', d.grade || '');
    setValue('level', d.level || undefined);
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (d: Form) => editing
      ? api.put(`/designations/${editing.id}`, d)
      : api.post('/designations', d),
    onSuccess: () => {
      toast.success(editing ? 'Designation updated' : 'Designation created');
      qc.invalidateQueries({ queryKey: ['designations'] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/designations/${id}`),
    onSuccess: () => { toast.success('Designation deleted'); qc.invalidateQueries({ queryKey: ['designations'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Cannot delete: designation is assigned to employees'),
  });

  return (
    <div>
      <PageHeader
        title="Designations"
        breadcrumb={['Setup', 'Designations']}
        actions={<Button variant="primary" icon={<IconPlus size={14} />} onClick={openCreate}>Add Designation</Button>}
      />

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)' }}>
              {['Designation', 'Grade', 'Level', 'Actions'].map(h => (
                <th key={h} className="th-label" style={{ padding: '8px 16px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} style={{ padding: 16 }}><SkeletonTable rows={5} cols={4} /></td></tr>
            ) : !data?.length ? (
              <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No designations yet. Add one to get started.</td></tr>
            ) : data.map((d: any) => (
              <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{d.name}</td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-2)' }}>{d.grade || '—'}</td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-2)' }}>{d.level ?? '—'}</td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button size="sm" icon={<IconPencil size={12} />} onClick={() => openEdit(d)}>Edit</Button>
                    <Button size="sm" variant="danger" icon={<IconTrash size={12} />}
                      onClick={() => { if (confirm(`Delete "${d.name}"?`)) deleteMutation.mutate(d.id); }}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Designation' : 'Add Designation'}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={handleSubmit(d => saveMutation.mutate(d))}>
              {editing ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Designation Name" required error={errors.name?.message} placeholder="e.g. Software Engineer" {...register('name')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Grade" error={errors.grade?.message} placeholder="e.g. L3, Senior" {...register('grade')} />
            <Input label="Level" type="number" error={errors.level?.message} placeholder="e.g. 3" {...register('level')} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
