import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useSearchParams } from 'react-router-dom';
import vendorApi from '@/lib/vendor-api';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge, { statusToBadge } from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';

const createSchema = z.object({
  name: z.string().min(2, 'Company name required'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Lowercase, numbers, hyphens only'),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
  planId: z.string().uuid('Select a plan'),
  trialDays: z.coerce.number().default(14),
  features: z.array(z.string()).default([]),
});
type CreateForm = z.infer<typeof createSchema>;

export default function VendorCompanies() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const statusFilter = searchParams.get('status') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-companies', statusFilter, search],
    queryFn: () => vendorApi.get('/tenants', { params: { status: statusFilter || undefined, search: search || undefined } }).then(r => r.data),
  });

  const { data: plansData } = useQuery({
    queryKey: ['vendor-plans'],
    queryFn: () => vendorApi.get('/plans').then(r => r.data.data),
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  const selectedPlanId = watch('planId');
  useEffect(() => {
    if (!selectedPlanId || !plansData) return;
    const plan = plansData.find((p: any) => p.id === selectedPlanId);
    if (plan && Array.isArray(plan.features)) {
      setValue('features', plan.features);
    }
  }, [selectedPlanId, plansData, setValue]);

  const createMutation = useMutation({
    mutationFn: (d: CreateForm) => vendorApi.post('/tenants', d),
    onSuccess: (res) => {
      toast.success(`Company created! HR Admin can login with the email and password you set.`);
      qc.invalidateQueries({ queryKey: ['vendor-companies'] });
      qc.invalidateQueries({ queryKey: ['vendor-dashboard'] });
      setCreateOpen(false);
      reset();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create company'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vendorApi.delete(`/tenants/${id}`),
    onSuccess: () => {
      toast.success('Company deleted');
      qc.invalidateQueries({ queryKey: ['vendor-companies'] });
      qc.invalidateQueries({ queryKey: ['vendor-dashboard'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to delete company'),
  });

  function autoSlug(name: string) {
    setValue('slug', name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  }

  const companies = data?.data || [];

  return (
    <div>
      <PageHeader
        title="Companies"
        breadcrumb={['Vendor', 'Companies']}
        actions={<Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setCreateOpen(true)}>New Company</Button>}
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <IconSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            placeholder="Search companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 30px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          />
        </div>
        <Badge variant={!statusFilter ? 'blue' : 'gray'} dot={false}>All: {data?.meta?.total ?? 0}</Badge>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-s)' }}>
              {['Company', 'Plan', 'Status', 'Employees', 'Expires', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left' }} className="th-label">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} style={{ padding: 16 }}><SkeletonTable rows={5} cols={6} /></td></tr>
            ) : companies.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No companies found</td></tr>
            ) : (
              companies.map((c: any) => {
                const expires = c.subscriptionEndsAt || c.trialEndsAt;
                const daysLeft = expires ? Math.ceil((new Date(expires).getTime() - Date.now()) / 864e5) : null;
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.slug}</div>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12.5 }}>{c.planName || '—'}</td>
                    <td style={{ padding: '10px 16px' }}><Badge variant={statusToBadge(c.status)}>{c.status}</Badge></td>
                    <td style={{ padding: '10px 16px', fontSize: 12.5 }}>{c.employeeCount ?? 0}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>
                      {expires ? (
                        <span style={{ color: daysLeft !== null && daysLeft <= 7 ? 'var(--danger)' : 'var(--text-2)' }}>
                          {new Date(expires).toLocaleDateString('en-IN')}
                          {daysLeft !== null && ` (${daysLeft}d)`}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link to={`/vendor/companies/${c.id}`}>
                          <Button size="sm">View</Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="danger"
                          icon={<IconTrash size={12} />}
                          loading={deleteMutation.isPending}
                          onClick={() => {
                            if (confirm(`Permanently delete "${c.name}" and all its data? This cannot be undone.`)) {
                              deleteMutation.mutate(c.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Company"
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={createMutation.isPending} onClick={handleSubmit(d => createMutation.mutate(d))}>Create Company</Button>
          </>
        }>
        <form style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label="Company Name" required error={errors.name?.message} {...register('name', { onChange: e => autoSlug(e.target.value) })} />
          <Input label="Slug (URL ID)" required error={errors.slug?.message} placeholder="acme-corp" {...register('slug')} />
          <Input label="HR Admin Email" type="email" required error={errors.adminEmail?.message} {...register('adminEmail')} />
          <Input label="HR Admin Password" type="password" required error={errors.adminPassword?.message} placeholder="Min 8 characters" {...register('adminPassword')} />
          <Select
            label="Plan" required error={errors.planId?.message}
            options={(plansData || []).map((p: any) => ({ value: p.id, label: `${p.name} — ₹${p.priceMonthly}/mo` }))}
            placeholder="Select a plan"
            {...register('planId')}
          />
          <Input label="Trial Days" type="number" defaultValue={14} {...register('trialDays')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="th-label" style={{ fontSize: 12, fontWeight: 600 }}>Customized Features</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '4px 0', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', paddingLeft: '8px', borderRadius: '4px' }}>
              {[
                { value: 'employees', label: 'HR / Employees' },
                { value: 'announcements', label: 'Announcements' },
                { value: 'performance', label: 'Performance' },
                { value: 'training', label: 'Training' },
                { value: 'expenses', label: 'Expenses' },
                { value: 'grievances', label: 'Grievances' },
                { value: 'recruitment', label: 'Recruitment' },
                { value: 'surveys', label: 'Surveys' },
                { value: 'helpdesk', label: 'Help Desk' },
                { value: 'timesheet', label: 'Timesheet' },
                { value: 'vault', label: 'Document Vault' },
                { value: 'onboarding', label: 'Onboarding & Separation' },
                { value: 'attendance', label: 'Attendance' },
                { value: 'geofence', label: 'Geo-fence Monitor' },
                { value: 'leave', label: 'Leave' },
                { value: 'payroll', label: 'Payroll' },
                { value: 'compliance', label: 'Compliance' },
                { value: 'reports', label: 'Reports & Analytics' },
                { value: 'api', label: 'Developer API' }
              ].map(f => (
                <label key={f.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>
                  <input type="checkbox" value={f.value} {...register('features')} />
                  <span style={{ color: 'var(--text-2)' }}>{f.label}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
