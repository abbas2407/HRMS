import { useQuery } from '@tanstack/react-query';
import vendorApi from '@/lib/vendor-api';
import PageHeader from '@/components/layout/PageHeader';
import { SkeletonTable } from '@/components/ui/Skeleton';
import Badge from '@/components/ui/Badge';
import { IconCreditCard } from '@tabler/icons-react';

export default function VendorSettingsPage() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ['vendor-plans'],
    queryFn: () => vendorApi.get('/plans').then(r => r.data.data),
  });

  return (
    <div>
      <PageHeader
        title="Settings"
        breadcrumb={['Vendor', 'Settings']}
      />

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconCreditCard size={16} color="var(--brand)" />
          <h3 style={{ margin: 0 }}>Subscription Plans</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)' }}>
              {['Plan', 'Monthly Price', 'Annual Price', 'Max Employees', 'Features', 'Status'].map(h => (
                <th key={h} className="th-label" style={{ padding: '8px 16px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} style={{ padding: 16 }}><SkeletonTable rows={4} cols={6} /></td></tr>
            ) : !plans?.length ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No plans configured</td></tr>
            ) : (
              plans.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.description}</div>}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>
                    {p.priceMonthly ? `₹${Number(p.priceMonthly).toLocaleString('en-IN')}/mo` : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>
                    {p.priceYearly ? `₹${Number(p.priceYearly).toLocaleString('en-IN')}/yr` : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>
                    {p.maxEmployees ?? '∞'}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                    {Array.isArray(p.features) ? p.features.join(', ') : '—'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge variant={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 4px' }}>Vendor Account</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-3)' }}>
          Vendor credentials are configured via environment variables on the server.
          Contact your system administrator to update the vendor password.
        </p>
        <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: '12px 16px', fontSize: 12.5, color: 'var(--text-2)', border: '1px solid var(--border)' }}>
          To change the vendor password, update <code style={{ background: 'var(--bg-surface)', padding: '1px 5px', borderRadius: 4 }}>VENDOR_ADMIN_PASSWORD</code> in the server
          <code style={{ background: 'var(--bg-surface)', padding: '1px 5px', borderRadius: 4, marginLeft: 4 }}>.env</code> file and restart the API container.
        </div>
      </div>
    </div>
  );
}
