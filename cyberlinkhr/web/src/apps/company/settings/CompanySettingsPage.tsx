import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconDeviceFloppy, IconSettings, IconUsers, IconForms, IconGitCommit, IconPlus, IconTrash } from '@tabler/icons-react';
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
  const [activeTab, setActiveTab] = useState<'general' | 'custom_fields' | 'permissions' | 'workflows'>('general');
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  // Custom Fields states
  const [customFieldModule, setCustomFieldModule] = useState('employee');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

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
                <optgroup key={role} label={role} style={{ fontStyle: 'normal' }}>
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
                        <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>
                          <span style={{ fontSize: 11, color: 'var(--color-primary)', marginRight: 6 }}>{role}</span>
                          {mod.toUpperCase()}
                        </td>
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
                </optgroup>
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
    </div>
  );
}
