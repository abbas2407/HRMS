import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconDeviceFloppy, IconSettings } from '@tabler/icons-react';

const INDIAN_STATES = [
  { code: 'MH', name: 'Maharashtra' }, { code: 'KA', name: 'Karnataka' },
  { code: 'TN', name: 'Tamil Nadu' }, { code: 'WB', name: 'West Bengal' },
  { code: 'AP', name: 'Andhra Pradesh' }, { code: 'TS', name: 'Telangana' },
  { code: 'DL', name: 'Delhi' }, { code: 'HR', name: 'Haryana' },
  { code: 'UP', name: 'Uttar Pradesh' }, { code: 'RJ', name: 'Rajasthan' },
  { code: 'GJ', name: 'Gujarat' }, { code: 'PB', name: 'Punjab' },
  { code: 'MP', name: 'Madhya Pradesh' }, { code: 'BR', name: 'Bihar' },
  { code: 'OR', name: 'Odisha' }, { code: 'KL', name: 'Kerala' },
  { code: 'AS', name: 'Assam' }, { code: 'JH', name: 'Jharkhand' },
  { code: 'UK', name: 'Uttarakhand' }, { code: 'HP', name: 'Himachal Pradesh' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
  color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box',
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 700, fontSize: 14 }}>{title}</div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

export default function CompanySettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['company-settings'],
    queryFn: () => api.get('/settings').then(r => r.data.data),
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.put('/settings/bulk', form).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const f = (key: string) => form[key] || '';
  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  if (isLoading) return <div style={{ padding: 24, color: 'var(--color-text-secondary)' }}>Loading...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconSettings size={22} color="var(--color-primary)" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Company Settings</h1>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>Organisation profile and statutory details</p>
          </div>
        </div>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', background: saved ? '#22c55e' : 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 14, transition: 'background 0.2s' }}>
          <IconDeviceFloppy size={16} />
          {saveMutation.isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <Section title="Organisation">
        <Field label="Company Name">
          <input style={inputStyle} value={f('company_name')} onChange={e => set('company_name', e.target.value)} placeholder="Acme Pvt. Ltd." />
        </Field>
        <Field label="State" hint="Used for Professional Tax calculation">
          <select style={inputStyle} value={f('state')} onChange={e => set('state', e.target.value)}>
            <option value="">Select state...</option>
            {INDIAN_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Timezone">
          <select style={inputStyle} value={f('timezone') || 'Asia/Kolkata'} onChange={e => set('timezone', e.target.value)}>
            <option value="Asia/Kolkata">IST — Asia/Kolkata (UTC+5:30)</option>
            <option value="Asia/Dubai">GST — Asia/Dubai (UTC+4)</option>
            <option value="UTC">UTC</option>
          </select>
        </Field>
        <Field label="Currency">
          <select style={inputStyle} value={f('currency') || 'INR'} onChange={e => set('currency', e.target.value)}>
            <option value="INR">INR — Indian Rupee (₹)</option>
            <option value="USD">USD — US Dollar ($)</option>
          </select>
        </Field>
      </Section>

      <Section title="Payroll Configuration">
        <Field label="Financial Year Start Month" hint="India: 4 (April). Change only if your FY differs.">
          <select style={inputStyle} value={f('financial_year_start') || '4'} onChange={e => set('financial_year_start', e.target.value)}>
            {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
              <option key={i} value={String(i + 1)}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Payroll Cut-off Day" hint="Day of month after which attendance is frozen for payroll. E.g. 25 means 25th of every month.">
          <input type="number" min={1} max={28} style={inputStyle} value={f('payroll_cutoff_day') || '25'} onChange={e => set('payroll_cutoff_day', e.target.value)} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Week Off Days" hint="Comma-separated: 0=Sun, 6=Sat">
            <input style={inputStyle} value={f('week_off_days') || '0,6'} onChange={e => set('week_off_days', e.target.value)} placeholder="0,6" />
          </Field>
          <Field label="Probation Period (days)">
            <input type="number" min={0} style={inputStyle} value={f('probation_days') || '90'} onChange={e => set('probation_days', e.target.value)} />
          </Field>
        </div>
        <Field label="Notice Period (days)" hint="Default notice period for separation">
          <input type="number" min={0} style={inputStyle} value={f('notice_period_days') || '30'} onChange={e => set('notice_period_days', e.target.value)} />
        </Field>
      </Section>

      <Section title="Statutory Registration Numbers">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Company PAN">
            <input style={inputStyle} value={f('pan_number')} onChange={e => set('pan_number', e.target.value.toUpperCase())} placeholder="AAAAA0000A" maxLength={10} />
          </Field>
          <Field label="TAN (Tax Deduction Account)">
            <input style={inputStyle} value={f('tan_number')} onChange={e => set('tan_number', e.target.value.toUpperCase())} placeholder="AAAA00000A" maxLength={10} />
          </Field>
          <Field label="PF Registration Number">
            <input style={inputStyle} value={f('pf_number')} onChange={e => set('pf_number', e.target.value)} placeholder="MH/MUM/12345/000/0000000" />
          </Field>
          <Field label="ESIC Registration Number">
            <input style={inputStyle} value={f('esic_number')} onChange={e => set('esic_number', e.target.value)} placeholder="31-00-123456-000-0000" />
          </Field>
          <Field label="PT Registration Number">
            <input style={inputStyle} value={f('pt_number')} onChange={e => set('pt_number', e.target.value)} placeholder="State-specific" />
          </Field>
        </div>
      </Section>
    </div>
  );
}
