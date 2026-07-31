import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { IconFileText, IconDownload, IconPlus, IconX, IconEye } from '@tabler/icons-react';

const LETTER_LABELS: Record<string, string> = {
  OFFER: 'Offer Letter', APPOINTMENT: 'Appointment Letter',
  RELIEVING: 'Relieving Letter', EXPERIENCE: 'Experience Letter',
  INCREMENT: 'Increment Letter', WARNING: 'Warning Letter',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
  color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box',
};

function printLetter(html: string) {
  const w = window.open('', '_blank', 'width=850,height=1000');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

export default function LettersPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'HR_ADMIN';
  const qc = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [viewHtml, setViewHtml] = useState<string | null>(null);
  const [form, setForm] = useState({ employeeId: '', templateId: '' });
  const [error, setError] = useState('');

  const { data: letters, isLoading } = useQuery<any[]>({
    queryKey: ['letters'],
    queryFn: () => api.get('/letters').then(r => r.data.data),
  });

  const { data: templates } = useQuery<any[]>({
    queryKey: ['letter-templates'],
    queryFn: () => api.get('/letters/templates').then(r => r.data.data),
    enabled: isAdmin,
  });

  const { data: employees } = useQuery<any[]>({
    queryKey: ['employees-list'],
    queryFn: () => api.get('/employees').then(r => r.data.data),
    enabled: isAdmin,
  });

  const generateMutation = useMutation({
    mutationFn: (body: any) => api.post('/letters/generate', body).then(r => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['letters'] });
      setShowModal(false);
      setForm({ employeeId: '', templateId: '' });
      setError('');
      setViewHtml(res.data.mergedHtml);
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed to generate'),
  });

  const handleGenerate = () => {
    if (!form.employeeId || !form.templateId) { setError('Select employee and letter type'); return; }
    generateMutation.mutate(form);
  };

  const viewLetter = async (id: string) => {
    const res = await api.get(`/letters/${id}`);
    setViewHtml(res.data.data.mergedHtml);
  };

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconFileText size={22} color="var(--color-primary)" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>HR Letters</h1>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>Generate offer, appointment, relieving & other letters</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            <IconPlus size={16} /> Generate Letter
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : (letters || []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
          <IconFileText size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
          <div>No letters generated yet.</div>
          {isAdmin && <div style={{ fontSize: 13, marginTop: 4 }}>Click "Generate Letter" to create one.</div>}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
                {['Employee', 'Letter Type', 'Generated On', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(letters || []).map((l: any) => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '11px 16px', fontWeight: 600 }}>{l.employeeName || '—'}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                      {LETTER_LABELS[l.type] || l.type}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px', color: 'var(--color-text-secondary)' }}>
                    {new Date(l.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => viewLetter(l.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-text)' }}>
                        <IconEye size={13} /> View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 480 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Generate Letter</div>
              <button onClick={() => { setShowModal(false); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                <IconX size={18} />
              </button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Employee *</label>
                <select style={inputStyle} value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">Select employee...</option>
                  {(employees || []).map((e: any) => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Letter Type *</label>
                <select style={inputStyle} value={form.templateId} onChange={e => setForm(f => ({ ...f, templateId: e.target.value }))}>
                  <option value="">Select type...</option>
                  {(templates || []).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
                <button onClick={handleGenerate} disabled={generateMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                  {generateMutation.isPending ? 'Generating...' : 'Generate & Preview'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Letter preview modal */}
      {viewHtml && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Letter Preview</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => printLetter(viewHtml)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <IconDownload size={14} /> Print / Save PDF
                </button>
                <button onClick={() => setViewHtml(null)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                  <IconX size={16} />
                </button>
              </div>
            </div>
            <iframe
              srcDoc={viewHtml}
              style={{ flex: 1, border: 'none', borderRadius: '0 0 14px 14px' }}
              title="Letter Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
