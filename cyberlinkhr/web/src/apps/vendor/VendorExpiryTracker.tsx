import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import vendorApi from '@/lib/vendor-api';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { IconAlertTriangle } from '@tabler/icons-react';

export default function VendorExpiryTracker() {
  const qc = useQueryClient();
  const [extendId, setExtendId] = useState<string | null>(null);
  const [days, setDays] = useState('14');
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-expiring'],
    queryFn: () => vendorApi.get('/tenants', { params: { expiring: 30 } }).then(r => r.data.data),
  });

  const trialMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: number }) => {
      const trialEndsAt = new Date(Date.now() + d * 864e5).toISOString();
      return vendorApi.put(`/tenants/${id}/trial`, { trialEndsAt });
    },
    onSuccess: () => { toast.success('Trial extended'); qc.invalidateQueries({ queryKey: ['vendor-expiring'] }); setExtendId(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => vendorApi.post('/billing', { tenantId: id, amount: Number(payAmount), method: 'BANK_TRANSFER' }),
    onSuccess: () => { toast.success('Payment recorded'); qc.invalidateQueries({ queryKey: ['vendor-expiring'] }); setPayId(null); setPayAmount(''); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const companies = (data || []).sort((a: any, b: any) => {
    const aDate = new Date(a.subscriptionEndsAt || a.trialEndsAt).getTime();
    const bDate = new Date(b.subscriptionEndsAt || b.trialEndsAt).getTime();
    return aDate - bDate;
  });

  return (
    <div>
      <PageHeader title="Expiring Soon" breadcrumb={['Vendor', 'Expiring Soon']} />

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconAlertTriangle size={15} color="var(--warning)" />
          <h3>Companies expiring in 30 days ({companies.length})</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)' }}>
              {['Company', 'Type', 'Expires On', 'Days Left', 'Actions'].map(h => (
                <th key={h} className="th-label" style={{ padding: '8px 16px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ padding: 16 }}><SkeletonTable rows={5} cols={5} /></td></tr>
            ) : companies.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No companies expiring in 30 days</td></tr>
            ) : (
              companies.map((c: any) => {
                const expiryDate = c.subscriptionEndsAt || c.trialEndsAt;
                const daysLeft = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 864e5);
                const urgency = daysLeft <= 3 ? 'danger' : daysLeft <= 7 ? 'warning' : 'gray';
                const isTrial = !c.subscriptionEndsAt && !!c.trialEndsAt;
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <Link to={`/vendor/companies/${c.id}`} style={{ color: 'var(--text-1)', fontWeight: 500, fontSize: 13, textDecoration: 'none' }}>{c.name}</Link>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.slug}</div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge variant={isTrial ? 'warning' : 'blue'} dot={false}>{isTrial ? 'Trial' : 'Paid'}</Badge>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12.5 }}>
                      {new Date(expiryDate).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge variant={urgency} dot={false}>{daysLeft}d left</Badge>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {isTrial && (
                          <Button size="sm" onClick={() => { setExtendId(c.id); setDays('14'); }}>Extend Trial</Button>
                        )}
                        <Button size="sm" variant="primary" onClick={() => { setPayId(c.id); setPayAmount(''); }}>Record Payment</Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!extendId} onClose={() => setExtendId(null)} title="Extend Trial"
        footer={<><Button onClick={() => setExtendId(null)}>Cancel</Button><Button variant="primary" loading={trialMutation.isPending} onClick={() => trialMutation.mutate({ id: extendId!, d: Number(days) })}>Extend</Button></>}>
        <Input label="Additional Days" type="number" value={days} onChange={e => setDays(e.target.value)} />
      </Modal>

      <Modal open={!!payId} onClose={() => setPayId(null)} title="Record Payment"
        footer={<><Button onClick={() => setPayId(null)}>Cancel</Button><Button variant="primary" loading={payMutation.isPending} onClick={() => payMutation.mutate(payId!)}>Record</Button></>}>
        <Input label="Amount (₹)" type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
      </Modal>
    </div>
  );
}
