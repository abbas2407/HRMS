import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import vendorApi from '@/lib/vendor-api';
import PageHeader from '@/components/layout/PageHeader';
import Badge, { statusToBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import Skeleton from '@/components/ui/Skeleton';
import { IconExternalLink, IconUserCheck, IconEdit } from '@tabler/icons-react';

const INDIAN_STATES = [
  'AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CG', 'DN', 'DD', 'DL', 'GA', 'GJ', 'HR', 'HP', 'JK', 'JH', 'KA', 'KL', 'LA', 'LD', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PY', 'PB', 'RJ', 'SK', 'TN', 'TS', 'TR', 'UP', 'UK', 'WB',
  'ANDAMAN AND NICOBAR ISLANDS', 'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR', 'CHANDIGARH', 'CHHATTISGARH',
  'DADRA AND NAGAR HAVELI AND DAMAN AND DIU', 'DELHI', 'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH',
  'JAMMU AND KASHMIR', 'JHARKHAND', 'KARNATAKA', 'KERALA', 'LADAKH', 'LAKSHADWEEP', 'MADHYA PRADESH', 'MAHARASHTRA',
  'MANIPUR', 'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'PUDUCHERRY', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL NADU',
  'TELANGANA', 'TRIPURA', 'UTTAR PRADESH', 'UTTARAKHAND', 'WEST BENGAL'
];

export default function VendorCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'billing' | 'usage'>('overview');
  const [extendOpen, setExtendOpen] = useState(false);
  const [trialDays, setTrialDays] = useState('14');
  const [subDate, setSubDate] = useState('');
  const [subOpen, setSubOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    adminEmail: '',
    planId: '',
    pfNumber: '',
    esicNumber: '',
    ptState: '',
    logoUrl: '',
    abbreviation: '',
    defaultCurrency: '',
    country: '',
    gstin: '',
    phone: '',
    fax: '',
    email: '',
    website: '',
    establishedDate: '',
    address: '',
    panNumber: '',
    cin: '',
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const validateEditForm = () => {
    const errs: Record<string, string> = {};
    if (!editForm.name.trim()) errs.name = 'Company name is required';
    if (!editForm.adminEmail.trim() || !/\S+@\S+\.\S+/.test(editForm.adminEmail)) errs.adminEmail = 'Valid email is required';
    if (!editForm.planId) errs.planId = 'Plan is required';

    if (editForm.pfNumber && !/^[A-Za-z]{2}[A-Za-z]{3}[0-9]{7}[0-9]{3}$/.test(editForm.pfNumber)) {
      errs.pfNumber = 'Invalid PF Number. Must be a 15-character establishment code (e.g. MHBAN0012345000)';
    }
    if (editForm.esicNumber && !/^\d{17}$/.test(editForm.esicNumber)) {
      errs.esicNumber = 'ESIC Number must be exactly 17 digits';
    }
    if (editForm.ptState && !INDIAN_STATES.includes(editForm.ptState.trim().toUpperCase())) {
      errs.ptState = 'Invalid State or UT name/code of India';
    }

    setEditErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-company', id],
    queryFn: () => vendorApi.get(`/tenants/${id}`).then(r => r.data.data),
  });

  const { data: plansData } = useQuery({
    queryKey: ['vendor-plans'],
    queryFn: () => vendorApi.get('/plans').then(r => r.data.data),
  });

  const { data: usage } = useQuery({
    queryKey: ['vendor-usage', id],
    queryFn: () => vendorApi.get(`/tenants/${id}/usage`).then(r => r.data.data),
    enabled: tab === 'usage',
  });

  const editMutation = useMutation({
    mutationFn: (values: typeof editForm) => vendorApi.put(`/tenants/${id}`, values),
    onSuccess: () => {
      toast.success('Company updated successfully');
      qc.invalidateQueries({ queryKey: ['vendor-company', id] });
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update company'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => vendorApi.put(`/tenants/${id}/status`, { status }),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['vendor-company', id] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const trialMutation = useMutation({
    mutationFn: (days: number) => {
      const d = new Date(Date.now() + days * 864e5).toISOString();
      return vendorApi.put(`/tenants/${id}/trial`, { trialEndsAt: d });
    },
    onSuccess: () => { toast.success('Trial extended'); qc.invalidateQueries({ queryKey: ['vendor-company', id] }); setExtendOpen(false); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const subMutation = useMutation({
    mutationFn: () => vendorApi.put(`/tenants/${id}/subscription`, { subscriptionEndsAt: new Date(subDate).toISOString() }),
    onSuccess: () => { toast.success('Subscription updated'); qc.invalidateQueries({ queryKey: ['vendor-company', id] }); setSubOpen(false); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const payMutation = useMutation({
    mutationFn: () => vendorApi.post('/billing', { tenantId: id, amount: Number(payAmount), method: 'BANK_TRANSFER' }),
    onSuccess: () => { toast.success('Payment recorded'); qc.invalidateQueries({ queryKey: ['vendor-company', id] }); setPayOpen(false); setPayAmount(''); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const resetPwMutation = useMutation({
    mutationFn: () => vendorApi.put(`/tenants/${id}/reset-password`, { password: newPassword }),
    onSuccess: () => {
      toast.success('Password reset successfully');
      setResetPwOpen(false);
      setNewPassword('');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to reset password'),
  });

  const impersonateMutation = useMutation({
    mutationFn: () => vendorApi.post(`/tenants/${id}/impersonate`),
    onSuccess: (res) => {
      const { token, tenant } = res.data.data;
      toast.success(`Impersonating ${tenant.name} — token copied`);
      navigator.clipboard.writeText(token).catch(() => {});
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const handleOpenEdit = () => {
    if (data) {
      setEditForm({
        name: data.name || '',
        adminEmail: data.adminEmail || '',
        planId: data.planId || '',
        pfNumber: data.pfNumber || '',
        esicNumber: data.esicNumber || '',
        ptState: data.ptState || '',
        logoUrl: data.logoUrl || '',
        abbreviation: data.abbreviation || '',
        defaultCurrency: data.defaultCurrency || '',
        country: data.country || '',
        gstin: data.gstin || '',
        phone: data.phone || '',
        fax: data.fax || '',
        email: data.email || '',
        website: data.website || '',
        establishedDate: data.establishedDate || '',
        address: data.address || '',
        panNumber: data.panNumber || '',
        cin: data.cin || '',
      });
      setEditErrors({});
      setEditOpen(true);
    }
  };

  if (isLoading) return <div style={{ padding: 24 }}><Skeleton height={200} /></div>;
  if (!data) return <div style={{ padding: 24, color: 'var(--text-3)' }}>Company not found</div>;

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    color: tab === t ? 'var(--brand)' : 'var(--text-2)',
    background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--brand)' : '2px solid transparent',
  });

  return (
    <div>
      <PageHeader
        title={data.name}
        breadcrumb={['Vendor', 'Companies', data.name]}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button icon={<IconUserCheck size={14} />} onClick={() => impersonateMutation.mutate()} loading={impersonateMutation.isPending}>
              Impersonate
            </Button>
          </div>
        }
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <Badge variant={statusToBadge(data.status)}>{data.status}</Badge>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{data.slug} · {data.planName}</span>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 20, display: 'flex' }}>
        {(['overview', 'billing', 'usage'] as const).map(t => (
          <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="Company Info" actions={
            <Button size="sm" icon={<IconEdit size={14} />} onClick={handleOpenEdit}>Edit</Button>
          }>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
              {[
                ['Admin Email', data.adminEmail],
                ['Abbreviation', data.abbreviation || '—'],
                ['Default Currency', data.defaultCurrency || '—'],
                ['Country', data.country || '—'],
                ['Company Logo URL', data.logoUrl || '—'],
                ['Tax ID (GSTIN)', data.gstin || '—'],
                ['Phone No', data.phone || '—'],
                ['Fax', data.fax || '—'],
                ['Company Email', data.email || '—'],
                ['Website', data.website || '—'],
                ['Established Date', data.establishedDate || '—'],
                ['Address', data.address || '—'],
                ['PAN Number', data.panNumber || '—'],
                ['CIN', data.cin || '—'],
                ['Plan', data.planName],
                ['Trial Ends', data.trialEndsAt ? new Date(data.trialEndsAt).toLocaleDateString('en-IN') : '—'],
                ['Subscription Ends', data.subscriptionEndsAt ? new Date(data.subscriptionEndsAt).toLocaleDateString('en-IN') : '—'],
                ['PF Number', data.pfNumber || '—'],
                ['ESIC Number', data.esicNumber || '—'],
                ['PT State', data.ptState || '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--text-3)' }}>{k}</span>
                  <span style={{ color: 'var(--text-1)', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Actions">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button onClick={() => setExtendOpen(true)}>Extend Trial</Button>
              <Button onClick={() => setSubOpen(true)}>Set Subscription Date</Button>
              <Button onClick={() => setPayOpen(true)}>Record Payment</Button>
              <Button onClick={() => setResetPwOpen(true)}>Reset HR Admin Password</Button>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                {data.status !== 'ACTIVE' && (
                  <Button variant="primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
                    onClick={() => statusMutation.mutate('ACTIVE')}>Activate</Button>
                )}
                {data.status !== 'SUSPENDED' && (
                  <Button variant="danger" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
                    onClick={() => statusMutation.mutate('SUSPENDED')}>Suspend</Button>
                )}
                {data.status !== 'CANCELLED' && (
                  <Button variant="danger" style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => { if (confirm('Cancel this account?')) statusMutation.mutate('CANCELLED'); }}>Cancel Account</Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'billing' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Payment History</h3>
            <Button size="sm" onClick={() => setPayOpen(true)}>+ Record Payment</Button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)' }}>
                {['Date', 'Amount', 'Method', 'Notes'].map(h => (
                  <th key={h} className="th-label" style={{ padding: '8px 16px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.billing?.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No payments recorded</td></tr>
              ) : data.billing?.map((b: any) => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontSize: 12.5 }}>{new Date(b.createdAt).toLocaleDateString('en-IN')}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, fontWeight: 600, color: 'var(--success)' }}>₹{Number(b.amount).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12.5 }}>{b.method}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--text-3)' }}>{b.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'usage' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            ['Employees', usage?.employeeCount ?? '—'],
            ['Payroll Runs (this month)', usage?.payrollRunsThisMonth ?? 0],
            ['Storage Used', `${usage?.storageUsed ?? 0} MB`],
          ].map(([k, v]) => (
            <div key={k} className="card" style={{ padding: 20 }}>
              <div className="form-label" style={{ marginBottom: 8 }}>{k}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-1)' }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <Modal open={extendOpen} onClose={() => setExtendOpen(false)} title="Extend Trial"
        footer={<><Button onClick={() => setExtendOpen(false)}>Cancel</Button><Button variant="primary" loading={trialMutation.isPending} onClick={() => trialMutation.mutate(Number(trialDays))}>Extend</Button></>}>
        <Input label="Additional Days" type="number" value={trialDays} onChange={e => setTrialDays(e.target.value)} />
      </Modal>

      <Modal open={subOpen} onClose={() => setSubOpen(false)} title="Set Subscription End Date"
        footer={<><Button onClick={() => setSubOpen(false)}>Cancel</Button><Button variant="primary" loading={subMutation.isPending} onClick={() => subMutation.mutate()}>Save</Button></>}>
        <Input label="Subscription Ends At" type="date" value={subDate} onChange={e => setSubDate(e.target.value)} />
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Payment"
        footer={<><Button onClick={() => setPayOpen(false)}>Cancel</Button><Button variant="primary" loading={payMutation.isPending} onClick={() => payMutation.mutate()}>Record</Button></>}>
        <Input label="Amount (₹)" type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
      </Modal>

      <Modal open={resetPwOpen} onClose={() => setResetPwOpen(false)} title="Reset HR Admin Password"
        footer={<><Button onClick={() => setResetPwOpen(false)}>Cancel</Button><Button variant="primary" loading={resetPwMutation.isPending} onClick={() => resetPwMutation.mutate()}>Reset Password</Button></>}>
        <Input label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" />
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Company Info"
        footer={<><Button onClick={() => setEditOpen(false)}>Cancel</Button><Button variant="primary" loading={editMutation.isPending} onClick={() => { if (validateEditForm()) editMutation.mutate(editForm); }}>Save</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 13, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>MANDATORY Fields</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Company Name" required error={editErrors.name} value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
            <Input label="Abbreviation" value={editForm.abbreviation} onChange={e => setEditForm(p => ({ ...p, abbreviation: e.target.value }))} />
            <Input label="HR Admin Email" required type="email" error={editErrors.adminEmail} value={editForm.adminEmail} onChange={e => setEditForm(p => ({ ...p, adminEmail: e.target.value }))} />
            <Select
              label="Plan"
              required
              error={editErrors.planId}
              options={(plansData || []).map((p: any) => ({ value: p.id, label: `${p.name} — ₹${p.priceMonthly}/mo` }))}
              value={editForm.planId}
              onChange={e => setEditForm(p => ({ ...p, planId: e.target.value }))}
            />
            <Input label="Default Currency" value={editForm.defaultCurrency} onChange={e => setEditForm(p => ({ ...p, defaultCurrency: e.target.value }))} />
            <Input label="Country" value={editForm.country} onChange={e => setEditForm(p => ({ ...p, country: e.target.value }))} />
          </div>

          <div style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 13, borderBottom: '1px solid var(--border)', paddingBottom: 4, marginTop: 8 }}>IMPORTANT Fields</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Company Logo URL" value={editForm.logoUrl} onChange={e => setEditForm(p => ({ ...p, logoUrl: e.target.value }))} />
            <Input label="Tax ID (GSTIN)" value={editForm.gstin} onChange={e => setEditForm(p => ({ ...p, gstin: e.target.value }))} />
            <Input label="Phone No" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
            <Input label="Fax" value={editForm.fax} onChange={e => setEditForm(p => ({ ...p, fax: e.target.value }))} />
            <Input label="Company Email" type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
            <Input label="Website" value={editForm.website} onChange={e => setEditForm(p => ({ ...p, website: e.target.value }))} />
            <Input label="Date of Establishment" type="date" value={editForm.establishedDate} onChange={e => setEditForm(p => ({ ...p, establishedDate: e.target.value }))} />
            <Input label="PAN Number" value={editForm.panNumber} onChange={e => setEditForm(p => ({ ...p, panNumber: e.target.value }))} />
            <Input label="CIN" value={editForm.cin} onChange={e => setEditForm(p => ({ ...p, cin: e.target.value }))} />
            <Input label="PF Number" error={editErrors.pfNumber} value={editForm.pfNumber} onChange={e => setEditForm(p => ({ ...p, pfNumber: e.target.value }))} />
            <Input label="ESIC Number" error={editErrors.esicNumber} value={editForm.esicNumber} onChange={e => setEditForm(p => ({ ...p, esicNumber: e.target.value }))} />
            <Input label="PT State" error={editErrors.ptState} value={editForm.ptState} onChange={e => setEditForm(p => ({ ...p, ptState: e.target.value }))} />
            <div style={{ gridColumn: 'span 2' }}>
              <Input label="Registered Address" value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
