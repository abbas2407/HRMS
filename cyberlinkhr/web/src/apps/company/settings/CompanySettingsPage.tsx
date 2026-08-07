import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconDeviceFloppy, IconSettings, IconUsers, IconForms, IconGitCommit, IconPlus, IconTrash, IconMail, IconFileText, IconEye, IconPencil, IconX, IconSend, IconUpload } from '@tabler/icons-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

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

const MODULES = ['employee', 'asset', 'leave', 'grievances'];
const ROLES = ['HR_ADMIN', 'MANAGER', 'EMPLOYEE', 'ACCOUNTANT', 'AUDITOR'];

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
  const [activeTab, setActiveTab] = useState<'general' | 'custom_fields' | 'permissions' | 'workflows' | 'print_formats' | 'email_alerts' | 'import_data'>('general');
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  // Print formats state
  const [pfEditId, setPfEditId] = useState<string | null>(null);
  const [pfForm, setPfForm] = useState({ module: 'employee', name: '', htmlTemplate: '', isDefault: false });
  const [pfPreview, setPfPreview] = useState<string | null>(null);

  // Email alert rules state
  const [alertEditId, setAlertEditId] = useState<string | null>(null);
  const [alertForm, setAlertForm] = useState({ name: '', doctype: 'employee', event: 'onSave', condition: 'true', subjectTemplate: '', bodyTemplate: '', isActive: true });

  // Custom Fields states
  const [customFieldModule, setCustomFieldModule] = useState('employee');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Load General Settings
  const { data, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['company-settings'],
    queryFn: () => api.get('/settings').then(r => r.data.data),
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  // Load Custom Fields
  const { data: fieldsData, refetch: refetchFields } = useQuery<any[]>({
    queryKey: ['custom-fields', customFieldModule],
    queryFn: () => api.get(`/framework/customisation/fields/${customFieldModule}`).then(r => r.data.data),
    enabled: activeTab === 'custom_fields',
  });

  // Load Permissions matrix
  const { data: permissionsData, refetch: refetchPermissions } = useQuery<any[]>({
    queryKey: ['permissions-matrix'],
    queryFn: () => api.get('/framework/permissions').then(r => r.data.data),
    enabled: activeTab === 'permissions',
  });

  const saveMutation = useMutation({
    mutationFn: () => api.put('/settings/bulk', form).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const addCustomFieldMutation = useMutation({
    mutationFn: () => api.post('/framework/customisation/fields', {
      module: customFieldModule,
      fieldName: newFieldName,
      label: newFieldLabel,
      fieldType: newFieldType,
      options: newFieldOptions ? newFieldOptions.split(',').map(s => s.trim()) : [],
      required: newFieldRequired,
    }),
    onSuccess: () => {
      refetchFields();
      setNewFieldName('');
      setNewFieldLabel('');
      setNewFieldType('text');
      setNewFieldOptions('');
      setNewFieldRequired(false);
    }
  });

  const deleteCustomFieldMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/framework/customisation/fields/${id}`),
    onSuccess: () => {
      refetchFields();
    }
  });

  const updatePermissionMutation = useMutation({
    mutationFn: (payload: any) => api.put('/framework/permissions', payload),
    onSuccess: () => {
      refetchPermissions();
    }
  });

  // Print Formats queries
  const { data: printFormatsData, refetch: refetchPrintFormats } = useQuery<any[]>({
    queryKey: ['print-formats'],
    queryFn: () => api.get('/framework/print-formats').then(r => r.data.data),
    enabled: activeTab === 'print_formats',
  });

  const savePrintFormatMutation = useMutation({
    mutationFn: () => pfEditId
      ? api.put(`/framework/print-formats/${pfEditId}`, pfForm)
      : api.post('/framework/print-formats', pfForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['print-formats'] });
      refetchPrintFormats();
      setPfEditId(null);
      setPfForm({ module: 'employee', name: '', htmlTemplate: '', isDefault: false });
    }
  });

  const deletePrintFormatMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/framework/print-formats/${id}`),
    onSuccess: () => { refetchPrintFormats(); }
  });

  // Email Alert rules queries
  const { data: emailAlertsData, refetch: refetchEmailAlerts } = useQuery<any[]>({
    queryKey: ['email-alerts'],
    queryFn: () => api.get('/framework/email-alerts').then(r => r.data.data),
    enabled: activeTab === 'email_alerts',
  });

  const saveAlertMutation = useMutation({
    mutationFn: () => alertEditId
      ? api.put(`/framework/email-alerts/${alertEditId}`, alertForm)
      : api.post('/framework/email-alerts', alertForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-alerts'] });
      refetchEmailAlerts();
      setAlertEditId(null);
      setAlertForm({ name: '', doctype: 'employee', event: 'onSave', condition: 'true', subjectTemplate: '', bodyTemplate: '', isActive: true });
    }
  });

  const deleteAlertMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/framework/email-alerts/${id}`),
    onSuccess: () => { refetchEmailAlerts(); }
  });

  const [testEmailTo, setTestEmailTo] = useState('');
  const testAlertMutation = useMutation({
    mutationFn: ({ id, toEmail }: { id: string; toEmail: string }) =>
      api.post(`/framework/email-alerts/${id}/test`, { toEmail }),
    onSuccess: () => { alert('Test email sent!'); setTestEmailTo(''); }
  });

  const f = (key: string) => form[key] || '';
  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  if (isLoading) return <div style={{ padding: 24, color: 'var(--color-text-secondary)' }}>Loading...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconSettings size={22} color="var(--color-primary)" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Company Settings</h1>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>Organisation profile, Customisation, RBAC Permissions, and Workflows</p>
          </div>
        </div>
        {activeTab === 'general' && (
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', background: saved ? '#22c55e' : 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 14, transition: 'background 0.2s' }}>
            <IconDeviceFloppy size={16} />
            {saveMutation.isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Settings Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', gap: 16, marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('general')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'general' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'general' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14.5
          }}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('custom_fields')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'custom_fields' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'custom_fields' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14.5
          }}
        >
          Custom Fields
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'permissions' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'permissions' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14.5
          }}
        >
          Permissions Matrix
        </button>
        <button
          onClick={() => setActiveTab('workflows')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'workflows' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'workflows' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14.5
          }}
        >
          Workflows
        </button>
        <button
          onClick={() => setActiveTab('print_formats')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'print_formats' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'print_formats' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14.5,
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <IconFileText size={14} /> Print Formats
        </button>
        <button
          onClick={() => setActiveTab('email_alerts')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'email_alerts' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'email_alerts' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14.5,
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <IconMail size={14} /> Email Alerts
        </button>
        <button
          onClick={() => setActiveTab('import_data')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'import_data' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'import_data' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14.5,
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <IconUpload size={14} /> Import Data
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'general' && (
        <>
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
                <optgroup label="Asia">
                  <option value="Asia/Kolkata">IST — Asia/Kolkata (UTC+5:30)</option>
                  <option value="Asia/Karachi">PKT — Asia/Karachi (UTC+5)</option>
                  <option value="Asia/Dhaka">BST — Asia/Dhaka (UTC+6)</option>
                  <option value="Asia/Colombo">SLST — Asia/Colombo (UTC+5:30)</option>
                  <option value="Asia/Kathmandu">NPT — Asia/Kathmandu (UTC+5:45)</option>
                  <option value="Asia/Dubai">GST — Asia/Dubai (UTC+4)</option>
                  <option value="Asia/Riyadh">AST — Asia/Riyadh (UTC+3)</option>
                  <option value="Asia/Kuwait">AST — Asia/Kuwait (UTC+3)</option>
                  <option value="Asia/Qatar">AST — Asia/Qatar (UTC+3)</option>
                  <option value="Asia/Bahrain">AST — Asia/Bahrain (UTC+3)</option>
                  <option value="Asia/Singapore">SGT — Asia/Singapore (UTC+8)</option>
                  <option value="Asia/Kuala_Lumpur">MYT — Asia/Kuala_Lumpur (UTC+8)</option>
                  <option value="Asia/Bangkok">ICT — Asia/Bangkok (UTC+7)</option>
                  <option value="Asia/Jakarta">WIB — Asia/Jakarta (UTC+7)</option>
                  <option value="Asia/Manila">PHT — Asia/Manila (UTC+8)</option>
                  <option value="Asia/Tokyo">JST — Asia/Tokyo (UTC+9)</option>
                  <option value="Asia/Seoul">KST — Asia/Seoul (UTC+9)</option>
                  <option value="Asia/Shanghai">CST — Asia/Shanghai (UTC+8)</option>
                  <option value="Asia/Hong_Kong">HKT — Asia/Hong_Kong (UTC+8)</option>
                  <option value="Asia/Taipei">CST — Asia/Taipei (UTC+8)</option>
                  <option value="Asia/Muscat">GST — Asia/Muscat (UTC+4)</option>
                  <option value="Asia/Tehran">IRST — Asia/Tehran (UTC+3:30)</option>
                  <option value="Asia/Beirut">EET — Asia/Beirut (UTC+2)</option>
                  <option value="Asia/Jerusalem">IST — Asia/Jerusalem (UTC+2)</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="Europe/London">GMT — Europe/London (UTC+0)</option>
                  <option value="Europe/Paris">CET — Europe/Paris (UTC+1)</option>
                  <option value="Europe/Berlin">CET — Europe/Berlin (UTC+1)</option>
                  <option value="Europe/Rome">CET — Europe/Rome (UTC+1)</option>
                  <option value="Europe/Madrid">CET — Europe/Madrid (UTC+1)</option>
                  <option value="Europe/Amsterdam">CET — Europe/Amsterdam (UTC+1)</option>
                  <option value="Europe/Moscow">MSK — Europe/Moscow (UTC+3)</option>
                  <option value="Europe/Istanbul">TRT — Europe/Istanbul (UTC+3)</option>
                  <option value="Europe/Zurich">CET — Europe/Zurich (UTC+1)</option>
                  <option value="Europe/Stockholm">CET — Europe/Stockholm (UTC+1)</option>
                </optgroup>
                <optgroup label="Americas">
                  <option value="America/New_York">EST — America/New_York (UTC-5)</option>
                  <option value="America/Chicago">CST — America/Chicago (UTC-6)</option>
                  <option value="America/Denver">MST — America/Denver (UTC-7)</option>
                  <option value="America/Los_Angeles">PST — America/Los_Angeles (UTC-8)</option>
                  <option value="America/Toronto">EST — America/Toronto (UTC-5)</option>
                  <option value="America/Vancouver">PST — America/Vancouver (UTC-8)</option>
                  <option value="America/Sao_Paulo">BRT — America/Sao_Paulo (UTC-3)</option>
                  <option value="America/Mexico_City">CST — America/Mexico_City (UTC-6)</option>
                  <option value="America/Bogota">COT — America/Bogota (UTC-5)</option>
                  <option value="America/Buenos_Aires">ART — America/Buenos_Aires (UTC-3)</option>
                </optgroup>
                <optgroup label="Africa & Pacific">
                  <option value="Africa/Cairo">EET — Africa/Cairo (UTC+2)</option>
                  <option value="Africa/Lagos">WAT — Africa/Lagos (UTC+1)</option>
                  <option value="Africa/Nairobi">EAT — Africa/Nairobi (UTC+3)</option>
                  <option value="Africa/Johannesburg">SAST — Africa/Johannesburg (UTC+2)</option>
                  <option value="Australia/Sydney">AEST — Australia/Sydney (UTC+10)</option>
                  <option value="Australia/Melbourne">AEST — Australia/Melbourne (UTC+10)</option>
                  <option value="Pacific/Auckland">NZST — Pacific/Auckland (UTC+12)</option>
                  <option value="UTC">UTC (UTC+0)</option>
                </optgroup>
              </select>
            </Field>
            <Field label="Currency">
              <select style={inputStyle} value={f('currency') || 'INR'} onChange={e => set('currency', e.target.value)}>
                <optgroup label="Asia">
                  <option value="INR">INR — Indian Rupee (₹)</option>
                  <option value="PKR">PKR — Pakistani Rupee (₨)</option>
                  <option value="BDT">BDT — Bangladeshi Taka (৳)</option>
                  <option value="LKR">LKR — Sri Lankan Rupee (Rs)</option>
                  <option value="NPR">NPR — Nepalese Rupee (Rs)</option>
                  <option value="AED">AED — UAE Dirham (د.إ)</option>
                  <option value="SAR">SAR — Saudi Riyal (﷼)</option>
                  <option value="QAR">QAR — Qatari Riyal (﷼)</option>
                  <option value="KWD">KWD — Kuwaiti Dinar (د.ك)</option>
                  <option value="BHD">BHD — Bahraini Dinar (.د.ب)</option>
                  <option value="OMR">OMR — Omani Rial (﷼)</option>
                  <option value="SGD">SGD — Singapore Dollar (S$)</option>
                  <option value="MYR">MYR — Malaysian Ringgit (RM)</option>
                  <option value="THB">THB — Thai Baht (฿)</option>
                  <option value="IDR">IDR — Indonesian Rupiah (Rp)</option>
                  <option value="PHP">PHP — Philippine Peso (₱)</option>
                  <option value="JPY">JPY — Japanese Yen (¥)</option>
                  <option value="KRW">KRW — South Korean Won (₩)</option>
                  <option value="CNY">CNY — Chinese Yuan (¥)</option>
                  <option value="HKD">HKD — Hong Kong Dollar (HK$)</option>
                  <option value="TWD">TWD — Taiwan Dollar (NT$)</option>
                  <option value="ILS">ILS — Israeli Shekel (₪)</option>
                </optgroup>
                <optgroup label="Americas">
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="CAD">CAD — Canadian Dollar (CA$)</option>
                  <option value="BRL">BRL — Brazilian Real (R$)</option>
                  <option value="MXN">MXN — Mexican Peso (MX$)</option>
                  <option value="ARS">ARS — Argentine Peso ($)</option>
                  <option value="COP">COP — Colombian Peso ($)</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="GBP">GBP — British Pound (£)</option>
                  <option value="CHF">CHF — Swiss Franc (Fr)</option>
                  <option value="SEK">SEK — Swedish Krona (kr)</option>
                  <option value="NOK">NOK — Norwegian Krone (kr)</option>
                  <option value="DKK">DKK — Danish Krone (kr)</option>
                  <option value="RUB">RUB — Russian Ruble (₽)</option>
                  <option value="TRY">TRY — Turkish Lira (₺)</option>
                  <option value="PLN">PLN — Polish Zloty (zł)</option>
                </optgroup>
                <optgroup label="Africa & Pacific">
                  <option value="ZAR">ZAR — South African Rand (R)</option>
                  <option value="NGN">NGN — Nigerian Naira (₦)</option>
                  <option value="KES">KES — Kenyan Shilling (KSh)</option>
                  <option value="EGP">EGP — Egyptian Pound (£)</option>
                  <option value="AUD">AUD — Australian Dollar (A$)</option>
                  <option value="NZD">NZD — New Zealand Dollar (NZ$)</option>
                </optgroup>
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
              <Field label="GST Registration Number">
                <input style={inputStyle} value={f('gst_number')} onChange={e => set('gst_number', e.target.value)} placeholder="22AAAAA0000A1Z5" />
              </Field>
              <Field label="PT Registration Number">
                <input style={inputStyle} value={f('pt_number')} onChange={e => set('pt_number', e.target.value)} placeholder="State-specific" />
              </Field>
            </div>
          </Section>
        </>
      )}

      {activeTab === 'custom_fields' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24 }}>
          {/* Custom Field Config Form */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 700 }}>Add Custom Field</h3>
            <Field label="Select Module">
              <Select options={MODULES.map(m => ({ value: m, label: m.toUpperCase() }))} value={customFieldModule} onChange={e => setCustomFieldModule(e.target.value)} />
            </Field>
            <Field label="Field ID Name" hint="Alphanumeric slug, e.g. blood_group">
              <Input placeholder="blood_group" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} />
            </Field>
            <Field label="Display Label" hint="User-friendly name, e.g. Blood Group">
              <Input placeholder="Blood Group" value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} />
            </Field>
            <Field label="Field Type">
              <Select
                options={[
                  { value: 'text', label: 'Text' },
                  { value: 'number', label: 'Number' },
                  { value: 'date', label: 'Date' },
                  { value: 'select', label: 'Select Dropdown' },
                  { value: 'boolean', label: 'Checkbox' },
                  { value: 'textarea', label: 'Text Area' },
                ]}
                value={newFieldType}
                onChange={e => setNewFieldType(e.target.value)}
              />
            </Field>
            {newFieldType === 'select' && (
              <Field label="Dropdown Options" hint="Comma-separated: A+, O-, B+">
                <Input placeholder="A+, O-, B+" value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} />
              </Field>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 20px 0' }}>
              <input type="checkbox" id="required-cb" checked={newFieldRequired} onChange={e => setNewFieldRequired(e.target.checked)} />
              <label htmlFor="required-cb" style={{ fontSize: 13, fontWeight: 600 }}>Mark as Required</label>
            </div>
            <Button
              variant="primary"
              icon={<IconPlus size={16} />}
              onClick={() => addCustomFieldMutation.mutate()}
              loading={addCustomFieldMutation.isPending}
            >
              Add Field
            </Button>
          </div>

          {/* Custom Fields List */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 700 }}>Custom Fields in {customFieldModule.toUpperCase()}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', fontSize: 12 }}>Label</th>
                  <th style={{ padding: '8px 12px', fontSize: 12 }}>Name</th>
                  <th style={{ padding: '8px 12px', fontSize: 12 }}>Type</th>
                  <th style={{ padding: '8px 12px', fontSize: 12 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {fieldsData?.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>No custom fields added yet.</td>
                  </tr>
                ) : (
                  fieldsData?.map((field) => (
                    <tr key={field.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>{field.label}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--color-text-secondary)' }}>{field.fieldName}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>{field.fieldType}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          onClick={() => deleteCustomFieldMutation.mutate(field.id)}
                          style={{ border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}
                        >
                          <IconTrash size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 700 }}>Granular Role Permission Matrix</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr style={{ background: 'var(--color-background-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12 }}>Role & Module</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12 }}>Read</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12 }}>Write</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12 }}>Create</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12 }}>Delete</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12 }}>Submit</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12 }}>Cancel</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12 }}>Export</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((role) => (
                <>
                  <tr key={`group-${role}`} style={{ background: 'var(--color-background-subtle)', borderBottom: '1px solid var(--color-border)', borderTop: '2px solid var(--color-border)' }}>
                    <td colSpan={8} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {role}
                    </td>
                  </tr>
                  {MODULES.map((mod) => {
                    const row = permissionsData?.find(p => p.role === role && p.module === mod) || {
                      role, module: mod, canRead: false, canWrite: false, canCreate: false, canDelete: false, canSubmit: false, canCancel: false, canExport: false
                    };

                    const handleToggle = (field: string, val: boolean) => {
                      updatePermissionMutation.mutate({
                        role,
                        module: mod,
                        ...row,
                        [field]: val
                      });
                    };

                    return (
                      <tr key={`${role}-${mod}`} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '8px 12px 8px 20px', fontSize: 13 }}>{mod.toUpperCase()}</td>
                        {['canRead', 'canWrite', 'canCreate', 'canDelete', 'canSubmit', 'canCancel', 'canExport'].map((permKey) => (
                          <td key={permKey} style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!!(row as any)[permKey]}
                              onChange={e => handleToggle(permKey, e.target.checked)}
                              style={{ width: 15, height: 15, cursor: 'pointer' }}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'workflows' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-secondary)', padding: '24px 0', justifyContent: 'center', flexDirection: 'column' }}>
            <IconGitCommit size={48} color="var(--color-primary)" />
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--color-text)' }}>Visual Workflow Engine</h3>
            <p style={{ margin: 0, fontSize: 13, textAlign: 'center', maxWidth: 450 }}>Configure visual state machines, initial/final states, transitions, approvals, and allowed actor roles for leave requests, timesheets, and expenditures.</p>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 16px', background: 'var(--color-background)', fontSize: 12.5, marginTop: 12 }}>
              Active Modules: Leave Requests, Grievance Resolutions.
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━ PRINT FORMATS ━━━━━━━━━━━━━━ */}
      {activeTab === 'print_formats' && (
        <div>
          <Section title="Print Format Editor">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Module</label>
                <select style={inputStyle} value={pfForm.module} onChange={e => setPfForm(p => ({ ...p, module: e.target.value }))}>
                  {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Format Name</label>
                <input style={inputStyle} value={pfForm.name} onChange={e => setPfForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Payslip Standard" />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>HTML Template</label>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                Variables: <code>{'{{ employee.first_name }}'}</code>, <code>{'{{ payslip.net_salary }}'}</code>, <code>{'{{ leave.startDate }}'}</code>
              </div>
              <textarea
                value={pfForm.htmlTemplate}
                onChange={e => setPfForm(p => ({ ...p, htmlTemplate: e.target.value }))}
                placeholder="<h1>{{ employee.first_name }} {{ employee.last_name }}</h1>..."
                style={{ ...inputStyle, height: 200, fontFamily: 'monospace', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={pfForm.isDefault} onChange={e => setPfForm(p => ({ ...p, isDefault: e.target.checked }))} />
                Set as default for this module
              </label>
              <div style={{ flex: 1 }} />
              {pfEditId && (
                <button onClick={() => { setPfEditId(null); setPfForm({ module: 'employee', name: '', htmlTemplate: '', isDefault: false }); }}
                  style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>
                  <IconX size={13} /> Cancel
                </button>
              )}
              <button onClick={() => savePrintFormatMutation.mutate()} disabled={!pfForm.name || !pfForm.htmlTemplate}
                style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconDeviceFloppy size={13} /> {pfEditId ? 'Update' : 'Save'} Format
              </button>
            </div>
          </Section>

          <Section title="Saved Print Formats">
            {pfPreview && (
              <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16, marginBottom: 16, fontFamily: 'serif' }}
                dangerouslySetInnerHTML={{ __html: pfPreview }} />
            )}
            {!printFormatsData?.length ? (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>No print formats defined yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Module</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Default</th>
                    <th style={{ padding: '6px 8px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(printFormatsData || []).map((pf: any) => (
                    <tr key={pf.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px' }}>{pf.name}</td>
                      <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{pf.module}</td>
                      <td style={{ padding: '8px' }}>{pf.isDefault ? '✓' : ''}</td>
                      <td style={{ padding: '8px', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setPfEditId(pf.id); setPfForm({ module: pf.module, name: pf.name, htmlTemplate: pf.htmlTemplate, isDefault: pf.isDefault }); }}
                          style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <IconPencil size={12} /> Edit
                        </button>
                        <button onClick={() => deletePrintFormatMutation.mutate(pf.id)}
                          style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <IconTrash size={12} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━ EMAIL ALERT RULES ━━━━━━━━━━━━━━ */}
      {activeTab === 'email_alerts' && (
        <div>
          <Section title="Create / Edit Alert Rule">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Rule Name</label>
                <input style={inputStyle} value={alertForm.name} onChange={e => setAlertForm(p => ({ ...p, name: e.target.value }))} placeholder="Leave approved notify" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Doctype</label>
                <select style={inputStyle} value={alertForm.doctype} onChange={e => setAlertForm(p => ({ ...p, doctype: e.target.value }))}>
                  {['employee', 'leave', 'payroll', 'attendance', 'grievance'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Event</label>
                <select style={inputStyle} value={alertForm.event} onChange={e => setAlertForm(p => ({ ...p, event: e.target.value }))}>
                  {['onCreate', 'onSave', 'onSubmit', 'onStatusChange', 'afterSave', 'afterSubmit'].map(ev => <option key={ev} value={ev}>{ev}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Condition <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>(e.g. status = APPROVED)</span></label>
              <input style={inputStyle} value={alertForm.condition} onChange={e => setAlertForm(p => ({ ...p, condition: e.target.value }))} placeholder="true" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Email Subject Template</label>
                <input style={inputStyle} value={alertForm.subjectTemplate} onChange={e => setAlertForm(p => ({ ...p, subjectTemplate: e.target.value }))} placeholder="Leave {{ leave.status }} for {{ employee.first_name }}" />
              </div>
              <div>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer', fontWeight: 600, marginBottom: 4 }}>
                  Active
                  <input type="checkbox" checked={alertForm.isActive} onChange={e => setAlertForm(p => ({ ...p, isActive: e.target.checked }))} />
                </label>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Enable/disable this alert rule</div>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Body Template</label>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Use: <code>{'{{ employee.first_name }}'}</code>, <code>{'{{ leave.startDate }}'}</code></div>
              <textarea
                value={alertForm.bodyTemplate}
                onChange={e => setAlertForm(p => ({ ...p, bodyTemplate: e.target.value }))}
                placeholder="Hello {{ employee.first_name }}, your leave has been {{ leave.status }}."
                style={{ ...inputStyle, height: 100, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              {alertEditId && (
                <button onClick={() => { setAlertEditId(null); setAlertForm({ name: '', doctype: 'employee', event: 'onSave', condition: 'true', subjectTemplate: '', bodyTemplate: '', isActive: true }); }}
                  style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>
                  Cancel
                </button>
              )}
              <button onClick={() => saveAlertMutation.mutate()} disabled={!alertForm.name || !alertForm.subjectTemplate}
                style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconDeviceFloppy size={13} /> {alertEditId ? 'Update' : 'Save'} Alert Rule
              </button>
            </div>
          </Section>

          <Section title="Alert Rules">
            {!emailAlertsData?.length ? (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>No alert rules defined. Default rules will be seeded when a company is created.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Doctype</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Event</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Active</th>
                    <th style={{ padding: '6px 8px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(emailAlertsData || []).map((rule: any) => (
                    <tr key={rule.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px' }}>{rule.name}</td>
                      <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{rule.doctype}</td>
                      <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{rule.event}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ background: rule.isActive ? '#dcfce7' : '#fef2f2', color: rule.isActive ? '#16a34a' : '#dc2626', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '8px', display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button onClick={() => { setAlertEditId(rule.id); setAlertForm({ name: rule.name, doctype: rule.doctype, event: rule.event, condition: rule.condition || 'true', subjectTemplate: rule.subjectTemplate, bodyTemplate: rule.bodyTemplate, isActive: rule.isActive }); }}
                          style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <IconPencil size={12} /> Edit
                        </button>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            type="email"
                            placeholder="test@email.com"
                            value={testEmailTo}
                            onChange={e => setTestEmailTo(e.target.value)}
                            style={{ padding: '3px 8px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 11, background: 'var(--color-background)', color: 'var(--color-text)', width: 130 }}
                          />
                          <button onClick={() => testEmailTo && testAlertMutation.mutate({ id: rule.id, toEmail: testEmailTo })}
                            disabled={!testEmailTo || testAlertMutation.isPending}
                            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, opacity: !testEmailTo ? 0.5 : 1 }}>
                            <IconSend size={11} /> Test
                          </button>
                        </div>
                        <button onClick={() => deleteAlertMutation.mutate(rule.id)}
                          style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <IconTrash size={12} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>
      )}

      {activeTab === 'import_data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Section title="Import Company Data">
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              Moving from another HRMS software? Upload your company data exported in JSON format to quickly provision departments, designations, shifts, and employees.
            </p>
            <div style={{ border: '2px dashed var(--color-border)', borderRadius: 12, padding: 32, textAlign: 'center', background: 'var(--color-background-subtle)', marginBottom: 20 }}>
              <IconUpload size={32} style={{ color: 'var(--color-text-secondary)', opacity: 0.5, marginBottom: 12 }} />
              <div style={{ marginBottom: 12 }}>
                <input
                  type="file"
                  accept=".json"
                  id="import-json-file"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImporting(true);
                    setImportResult(null);
                    setImportError(null);
                    const text = await file.text();
                    try {
                      const payload = JSON.parse(text);
                      const res = await api.post('/settings/import-company', payload);
                      setImportResult(res.data.data);
                    } catch (err: any) {
                      setImportError(err?.response?.data?.error || err.message || 'Import failed');
                    } finally {
                      setImporting(false);
                    }
                  }}
                />
                <button
                  onClick={() => document.getElementById('import-json-file')?.click()}
                  disabled={importing}
                  style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: importing ? 0.6 : 1 }}
                >
                  {importing ? 'Importing...' : 'Choose JSON File'}
                </button>
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Accepts .json file with departments, designations, shifts, and employees lists.</span>
            </div>

            {importError && (
              <div style={{
                marginBottom: 20,
                padding: 12,
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                borderRadius: 8,
                color: '#dc2626',
                fontSize: 13
              }}>
                <strong>Error: </strong> {importError}
              </div>
            )}

            {importResult && (
              <div style={{
                marginBottom: 20,
                padding: 16,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                color: '#15803d',
                fontSize: 13
              }}>
                <strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>✓ Import Successful</strong>
                <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
                  <li>Employees Imported: <strong>{importResult.importedEmployees}</strong></li>
                  <li>Total Employees: <strong>{importResult.totalEmployees}</strong></li>
                  <li>Total Departments: <strong>{importResult.totalDepartments}</strong></li>
                  <li>Total Designations: <strong>{importResult.totalDesignations}</strong></li>
                </ul>
              </div>
            )}
            
            <h4 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 700 }}>Example JSON Format:</h4>
            <pre style={{ background: 'var(--color-background)', color: 'var(--color-text)', padding: 14, borderRadius: 8, overflowX: 'auto', fontSize: 12, border: '1px solid var(--color-border)', margin: 0 }}>
{`{
  "departments": [
    { "name": "Engineering" },
    { "name": "HR" }
  ],
  "designations": [
    { "name": "Senior Software Engineer", "grade": "L5", "level": 5 },
    { "name": "HR Executive", "grade": "L3", "level": 3 }
  ],
  "shifts": [
    { "name": "Day Shift", "startTime": "09:00", "endTime": "18:00" }
  ],
  "employees": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@demo.com",
      "phone": "9876543210",
      "gender": "MALE",
      "dob": "1995-01-01",
      "joiningDate": "2023-01-01",
      "departmentName": "Engineering",
      "designationName": "Senior Software Engineer",
      "employmentType": "FULL_TIME",
      "workLocation": "Mumbai"
    }
  ]
}`}
            </pre>
          </Section>
        </div>
      )}
    </div>
  );
}
