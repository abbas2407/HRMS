import { useQuery } from '@tanstack/react-query';
import vendorApi from '@/lib/vendor-api';
import PageHeader from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/Card';
import Badge, { statusToBadge } from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import { IconBuilding, IconClock, IconAlertTriangle, IconMoneybag } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

export default function VendorDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['vendor-dashboard'],
    queryFn: () => vendorApi.get('/dashboard').then(r => r.data.data),
  });

  return (
    <div>
      <PageHeader title="Dashboard" />

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: '16px 20px' }}>
              <Skeleton height={14} width={80} style={{ marginBottom: 12 }} />
              <Skeleton height={28} width={60} />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Total Companies" value={data?.total ?? 0} icon={<IconBuilding size={18} />} color="var(--brand)" />
            <StatCard label="Active" value={data?.active ?? 0} icon={<IconBuilding size={18} />} color="var(--success)" />
            <StatCard label="On Trial" value={data?.trial ?? 0} icon={<IconClock size={18} />} color="var(--warning)" />
            <StatCard label="Monthly Revenue" value={`₹${(data?.mrr ?? 0).toLocaleString('en-IN')}`} sub="Active plans" icon={<IconMoneybag size={18} />} color="var(--purple)" />
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Expiring soon */}
        <div className="card">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconAlertTriangle size={15} color="var(--warning)" />
            <h3>Expiring in 14 days ({data?.expiring14 ?? 0})</h3>
          </div>
          <div style={{ padding: '8px 0' }}>
            {isLoading ? (
              <div style={{ padding: '8px 16px' }}><Skeleton height={14} /></div>
            ) : data?.expiringList?.length === 0 ? (
              <div style={{ padding: '16px', color: 'var(--text-3)', textAlign: 'center', fontSize: 12 }}>No companies expiring soon</div>
            ) : (
              data?.expiringList?.map((t: any) => {
                const daysLeft = Math.ceil((new Date(t.subscriptionEndsAt).getTime() - Date.now()) / 864e5);
                return (
                  <Link key={t.id} to={`/vendor/companies/${t.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', textDecoration: 'none', color: 'inherit' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-1)' }}>{t.name}</span>
                    <Badge variant={daysLeft <= 3 ? 'danger' : 'warning'} dot={false}>{daysLeft}d left</Badge>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Recent companies */}
        <div className="card">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <h3>Recent Companies</h3>
          </div>
          <div style={{ padding: '8px 0' }}>
            {isLoading ? (
              <div style={{ padding: '8px 16px' }}><Skeleton height={14} /></div>
            ) : (
              data?.recentTenants?.map((t: any) => (
                <Link key={t.id} to={`/vendor/companies/${t.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', textDecoration: 'none', color: 'inherit' }}>
                  <div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-1)', fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.slug}</div>
                  </div>
                  <Badge variant={statusToBadge(t.status)} dot>{t.status}</Badge>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
