import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import vendorApi from '@/lib/vendor-api';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { IconBell, IconPlus } from '@tabler/icons-react';

const schema = z.object({
  title: z.string().min(3, 'Title required'),
  body: z.string().min(10, 'Message required'),
  targetTenantId: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function VendorAnnouncementsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: companies } = useQuery({
    queryKey: ['vendor-companies-all'],
    queryFn: () => vendorApi.get('/tenants', { params: { limit: 200 } }).then(r => r.data.data),
  });

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['vendor-announcements'],
    queryFn: () => vendorApi.get('/announcements').then(r => r.data.data).catch(() => []),
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<Form>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (d: Form) => vendorApi.post('/announcements', d),
    onSuccess: () => {
      toast.success('Announcement sent');
      qc.invalidateQueries({ queryKey: ['vendor-announcements'] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to send'),
  });

  const rows: any[] = announcements || [];

  return (
    <div>
      <PageHeader
        title="Announcements"
        breadcrumb={['Vendor', 'Announcements']}
        actions={
          <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setOpen(true)}>
            New Announcement
          </Button>
        }
      />

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconBell size={16} color="var(--brand)" />
          <h3 style={{ margin: 0 }}>Sent Announcements</h3>
        </div>

        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Loading...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <IconBell size={32} color="var(--text-3)" />
            <div style={{ marginTop: 12, fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>No announcements yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
              Send a broadcast to all companies or a specific tenant.
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)' }}>
                {['Date', 'Title', 'Message', 'Target'].map(h => (
                  <th key={h} className="th-label" style={{ padding: '8px 16px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a: any) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                    {new Date(a.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{a.title}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--text-2)', maxWidth: 400 }}>{a.body}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                    {a.targetTenantName || 'All companies'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Send Announcement"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={mutation.isPending} onClick={handleSubmit(d => mutation.mutate(d))}>
              Send
            </Button>
          </>
        }
      >
        <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Title" required error={errors.title?.message} {...register('title')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Message <span style={{ color: 'var(--danger)' }}>*</span></label>
            <textarea
              rows={4}
              style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
              {...register('body')}
            />
            {errors.body && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{errors.body.message}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Target (leave blank for all companies)</label>
            <select
              style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
              {...register('targetTenantId')}
            >
              <option value="">All companies</option>
              {(companies || []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
