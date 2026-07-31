import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { IconPencil, IconDeviceFloppy, IconX } from '@tabler/icons-react';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
  color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box',
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--color-text)' }}>{value || '—'}</div>
    </div>
  );
}

export default function MyProfilePage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [pwModal, setPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');

  const { data: emp, isLoading } = useQuery<any>({
    queryKey: ['my-profile'],
    queryFn: () => api.get(`/employees/${user?.userId}`).then(r => r.data.data),
    enabled: !!user?.userId,
  });

  function startEdit() { setForm({ phone: emp?.phone || '', workLocation: emp?.workLocation || '' }); setEditing(true); }

  const updateMutation = useMutation({
    mutationFn: () => api.put(`/employees/${user?.userId}`, form).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-profile'] }); setEditing(false); },
  });

  const pwMutation = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }).then(r => r.data),
    onSuccess: () => { setPwModal(false); setPwForm({ currentPassword: '', newPassword: '', confirm: '' }); setPwError(''); },
    onError: (e: any) => setPwError(e?.response?.data?.error || 'Failed to change password'),
  });

  function handlePwSubmit() {
    if (pwForm.newPassword !== pwForm.confirm) { setPwError('Passwords do not match'); return; }
    if (pwForm.newPassword.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    pwMutation.mutate();
  }

  if (isLoading) return <div style={{ padding: 24, color: 'var(--color-text-secondary)' }}>Loading...</div>;

  const avatar = emp ? `${emp.firstName?.[0]}${emp.lastName?.[0]}` : '?';

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>My Profile</h1>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '24px 24px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-primary)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {avatar}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{emp?.firstName} {emp?.lastName}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{emp?.employeeCode} · {user?.role?.replace('_', ' ')}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {!editing ? (
              <button onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <IconPencil size={14} /> Edit
              </button>
            ) : (
              <>
                <button onClick={() => updateMutation.mutate()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <IconDeviceFloppy size={14} /> Save
                </button>
                <button onClick={() => setEditing(false)} style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  <IconX size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Personal details */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 32px' }}>
            <Field label="Email" value={emp?.email || user?.email || ''} />
            <Field label="Employee Code" value={emp?.employeeCode || ''} />
            <Field label="Date of Birth" value={emp?.dob || ''} />
            <Field label="Gender" value={emp?.gender || ''} />
            <Field label="Joining Date" value={emp?.joiningDate || ''} />
            <Field label="Department" value={emp?.departmentName || ''} />
            <Field label="Designation" value={emp?.designationName || ''} />
            <Field label="Employment Type" value={emp?.employmentType?.replace('_', ' ') || ''} />
          </div>

          <div style={{ height: 1, background: 'var(--color-border)', margin: '16px 0' }} />

          {/* Editable fields */}
          {editing ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Phone</label>
                <input style={inputStyle} value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Work Location</label>
                <input style={inputStyle} value={form.workLocation} onChange={e => setForm((f: any) => ({ ...f, workLocation: e.target.value }))} placeholder="Mumbai, WFH..." />
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 32px' }}>
              <Field label="Phone" value={emp?.phone || ''} />
              <Field label="Work Location" value={emp?.workLocation || ''} />
            </div>
          )}
        </div>
      </div>

      {/* Security */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 700, fontSize: 14 }}>Security</div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Password</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Change your login password</div>
            </div>
            <button onClick={() => setPwModal(true)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
              Change Password
            </button>
          </div>
        </div>
      </div>

      {pwModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 28, width: 380 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Change Password</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Current Password', key: 'currentPassword', placeholder: '••••••••' },
                { label: 'New Password', key: 'newPassword', placeholder: 'Min. 8 characters' },
                { label: 'Confirm New Password', key: 'confirm', placeholder: '••••••••' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>{f.label}</label>
                  <input type="password" placeholder={f.placeholder} value={(pwForm as any)[f.key]}
                    onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
                </div>
              ))}
              {pwError && <div style={{ color: '#ef4444', fontSize: 13 }}>{pwError}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setPwModal(false); setPwError(''); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button onClick={handlePwSubmit} disabled={pwMutation.isPending}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  {pwMutation.isPending ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
