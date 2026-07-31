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
});
type Form = z.infer<typeof schema>;

export default function DepartmentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data.data),
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<Form>({ resolver: zodResolver(schema) });

  function openCreate() {
    setEditing(null);
    reset({ name: '' });
    setOpen(true);
  }

  function openEdit(dept: any) {
    setEditing(dept);
    setValue('name', dept.name);
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (d: Form) => editing
      ? api.put(`/departments/${editing.id}`, d)
      : api.post('/departments', d),
    onSuccess: () => {
      toast.success(editing ? 'Department updated' : 'Department created');
      qc.invalidateQueries({ queryKey: ['departments'] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => { toast.success('Department deleted'); qc.invalidateQueries({ queryKey: ['departments'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Cannot delete: department has employees'),
  });

  return (
    <div>
      <PageHeader
        title="Departments"
        breadcrumb={['Setup', 'Departments']}
        actions={<Button variant="primary" icon={<IconPlus size={14} />} onClick={openCreate}>Add Department</Button>}
      />

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)' }}>
              {['Department', 'Employees', 'Actions'].map(h => (
                <th key={h} className="th-label" style={{ padding: '8px 16px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={3} style={{ padding: 16 }}><SkeletonTable rows={5} cols={3} /></td></tr>
            ) : !data?.length ? (
              <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No departments yet</td></tr>
            ) : data.map((d: any) => (
              <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{d.name}</td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-2)' }}>{d.employeeCount ?? 0} active</td>
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
        title={editing ? 'Edit Department' : 'Add Department'}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={handleSubmit(d => saveMutation.mutate(d))}>
              {editing ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <Input label="Department Name" required error={errors.name?.message} {...register('name')} />
      </Modal>
    </div>
  );
}
