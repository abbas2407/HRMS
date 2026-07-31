import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import vendorApi from '@/lib/vendor-api';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/Card';
import { toast } from '@/components/ui/Toast';
import { IconMoneybag, IconPlus } from '@tabler/icons-react';

const paySchema = z.object({
  tenantId: z.string().uuid('Select a company'),
  amount: z.coerce.number().positive('Enter valid amount'),
  method: z.enum(['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH', 'RAZORPAY']),
  notes: z.string().optional(),
});
type PayForm = z.infer<typeof paySchema>;

export default function VendorBillingPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: dash } = useQuery({
    queryKey: ['vendor-dashboard'],
    queryFn: () => vendorApi.get('/dashboard').then(r => r.data.data),
  });

  const { data: payments, isLoading } = useQuery({
    queryKey: ['vendor-payments'],
    queryFn: () => vendorApi.get('/billing').then(r => r.data.data),
  });

  const { data: companies } = useQuery({
    queryKey: ['vendor-companies-all'],
    queryFn: () => vendorApi.get('/tenants', { params: { limit: 200 } }).then(r => r.data.data),
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<PayForm>({ resolver: zodResolver(paySchema) });

  const mutation = useMutation({
    mutationFn: (d: PayForm) => vendorApi.post('/billing', d),
    onSuccess: () => { toast.success('Payment recorded'); qc.invalidateQueries({ queryKey: ['vendor-payments'] }); qc.invalidateQueries({ queryKey: ['vendor-dashboard'] }); setOpen(false); reset(); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  return (
    <div>
      <PageHeader
        title="Billing & Payments"
        breadcrumb={['Vendor', 'Billing']}
        actions={<Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setOpen(true)}>Record Payment</Button>}
      />

      {/* MRR stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Monthly Recurring Revenue" value={`₹${(dash?.mrr ?? 0).toLocaleString('en-IN')}`} icon={<IconMoneybag size={18} />} color="var(--success)" />
        <StatCard label="Active Subscriptions" value={dash?.active ?? 0} icon={<IconMoneybag size={18} />} color="var(--brand)" />
        <StatCard label="Trial Accounts" value={dash?.trial ?? 0} icon={<IconMoneybag size={18} />} color="var(--warning)" />
      </div>

      {/* Payments table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <h3>Payment History</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)' }}>
              {['Date', 'Company', 'Amount', 'Method', 'Notes', 'Recorded By'].map(h => (
                <th key={h} className="th-label" style={{ padding: '8px 16px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} style={{ padding: 16 }}><SkeletonTable rows={6} cols={6} /></td></tr>
            ) : !payments?.length ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No payments recorded</td></tr>
            ) : (
              payments.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontSize: 12.5 }}>{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, fontWeight: 500 }}>{p.tenantName}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, fontWeight: 600, color: 'var(--success)' }}>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12 }}>{p.method}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)' }}>{p.notes || '—'}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)' }}>{p.recordedBy}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Record Payment"
        footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={mutation.isPending} onClick={handleSubmit(d => mutation.mutate(d))}>Record</Button></>}>
        <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Select
            label="Company" required error={errors.tenantId?.message}
            options={(companies || []).map((c: any) => ({ value: c.id, label: c.name }))}
            placeholder="Select company"
            {...register('tenantId')}
          />
          <Input label="Amount (₹)" type="number" required error={errors.amount?.message} {...register('amount')} />
          <Select
            label="Payment Method" required error={errors.method?.message}
            options={[
              { value: 'BANK_TRANSFER', label: 'Bank Transfer (NEFT/RTGS)' },
              { value: 'UPI', label: 'UPI' },
              { value: 'CHEQUE', label: 'Cheque' },
              { value: 'CASH', label: 'Cash' },
              { value: 'RAZORPAY', label: 'Razorpay' },
            ]}
            {...register('method')}
          />
          <Input label="Notes (optional)" error={errors.notes?.message} {...register('notes')} />
        </form>
      </Modal>
    </div>
  );
}
