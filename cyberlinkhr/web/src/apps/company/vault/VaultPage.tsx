import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { IconVault, IconPlus, IconDownload, IconTrash, IconFolderPlus, IconSearch, IconX, IconUpload } from '@tabler/icons-react';

const ICONS = ['📁', '📋', '📜', '📊', '🏢', '⚖️', '🛡️', '💼', '📑', '🎓', '💰', '🔒'];

function fmtSize(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fileIcon(mime: string | null) {
  if (!mime) return '📄';
  if (mime === 'application/pdf') return '📕';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.includes('word')) return '📝';
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊';
  return '📄';
}

// ── Create Folder Modal ────────────────────────────────────────────────────────
function FolderModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', icon: '📁', targetType: 'ALL', targetRole: '', departmentId: '' });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.post('/vault/folders', {
        name: form.name, description: form.description || undefined, icon: form.icon,
        targetType: form.targetType,
        targetRole: form.targetType === 'ROLE' ? form.targetRole || undefined : undefined,
        departmentId: form.targetType === 'DEPARTMENT' ? form.departmentId || undefined : undefined,
      });
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: 28, width: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>New Folder</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Folder Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. HR Policies"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, background: 'var(--color-bg)', color: 'inherit', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ICONS.map(ic => (
              <button key={ic} onClick={() => set('icon', ic)}
                style={{ fontSize: 20, padding: '4px 8px', border: `2px solid ${form.icon === ic ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 8, background: form.icon === ic ? 'rgba(99,102,241,0.1)' : 'none', cursor: 'pointer' }}>
                {ic}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, resize: 'none', background: 'var(--color-bg)', color: 'inherit', boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Visible To</label>
          <select value={form.targetType} onChange={e => set('targetType', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, background: 'var(--color-bg)', color: 'inherit' }}>
            <option value="ALL">Everyone</option>
            <option value="ROLE">Specific Role</option>
            <option value="DEPARTMENT">Specific Department</option>
          </select>
          {form.targetType === 'ROLE' && (
            <select value={form.targetRole} onChange={e => set('targetRole', e.target.value)}
              style={{ width: '100%', marginTop: 8, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, background: 'var(--color-bg)', color: 'inherit' }}>
              <option value="">Select role…</option>
              <option value="HR_ADMIN">HR Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1px solid var(--color-border)', background: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !form.name.trim()}
            style={{ padding: '8px 18px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Document Modal ─────────────────────────────────────────────────────
function UploadModal({ folderId, onClose, onSave }: { folderId: string; onClose: () => void; onSave: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title.trim());
      if (description.trim()) fd.append('description', description.trim());
      await api.post(`/vault/folders/${folderId}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: 28, width: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Upload Document</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Document title"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, background: 'var(--color-bg)', color: 'inherit', boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, resize: 'none', background: 'var(--color-bg)', color: 'inherit', boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>File * (PDF, Word, Excel, Image — max 20 MB)</label>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={e => setFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
          <div onClick={() => fileRef.current?.click()}
            style={{ border: '2px dashed var(--color-border)', borderRadius: 10, padding: '20px 16px', textAlign: 'center', cursor: 'pointer', background: file ? 'rgba(99,102,241,0.04)' : 'var(--color-bg)' }}>
            {file ? (
              <div>
                <div style={{ fontSize: 22 }}>{fileIcon(file.type)}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{file.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{fmtSize(file.size)}</div>
              </div>
            ) : (
              <div>
                <IconUpload size={24} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Click to select a file</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1px solid var(--color-border)', background: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !title.trim() || !file}
            style={{ padding: '8px 18px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            {saving ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VaultPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'HR_ADMIN';

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { data: folders = [] } = useQuery<any[]>({
    queryKey: ['vault-folders'],
    queryFn: () => api.get('/vault/folders').then(r => r.data.data),
  });

  const selectedFolder = folders.find(f => f.id === selectedFolderId);

  const { data: docs = [] } = useQuery<any[]>({
    queryKey: ['vault-docs', selectedFolderId],
    queryFn: () => api.get(`/vault/folders/${selectedFolderId}/documents`).then(r => r.data.data),
    enabled: !!selectedFolderId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vault/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault-docs', selectedFolderId] }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/vault/folders/${id}`, { isArchived: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vault-folders'] });
      setSelectedFolderId(null);
    },
  });

  const filteredDocs = docs.filter(d =>
    !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.fileName.toLowerCase().includes(search.toLowerCase())
  );

  const getVisibilityLabel = (f: any) => {
    if (f.targetType === 'ALL') return 'Everyone';
    if (f.targetType === 'ROLE') return f.targetRole || 'Role';
    if (f.targetType === 'DEPARTMENT') return 'Department';
    return f.targetType;
  };

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {showFolderModal && (
        <FolderModal onClose={() => setShowFolderModal(false)} onSave={() => { setShowFolderModal(false); qc.invalidateQueries({ queryKey: ['vault-folders'] }); }} />
      )}
      {showUploadModal && selectedFolderId && (
        <UploadModal folderId={selectedFolderId} onClose={() => setShowUploadModal(false)}
          onSave={() => { setShowUploadModal(false); qc.invalidateQueries({ queryKey: ['vault-docs', selectedFolderId] }); qc.invalidateQueries({ queryKey: ['vault-folders'] }); }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconVault size={22} color="var(--color-primary)" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Document Vault</h1>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>Company policies, handbooks, and forms</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowFolderModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            <IconFolderPlus size={14} /> New Folder
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
        {/* Folder list */}
        <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.06em', marginBottom: 6, paddingLeft: 4 }}>
            FOLDERS ({folders.length})
          </div>
          {!folders.length ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-text-secondary)', fontSize: 13, border: '1px dashed var(--color-border)', borderRadius: 10 }}>
              {isAdmin ? 'Create your first folder.' : 'No folders available.'}
            </div>
          ) : folders.map(f => (
            <button key={f.id} onClick={() => setSelectedFolderId(f.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9,
                border: selectedFolderId === f.id ? '1.5px solid var(--color-primary)' : '1.5px solid transparent',
                background: selectedFolderId === f.id ? 'rgba(99,102,241,0.07)' : 'none',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{f.icon || '📁'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                  {f.docCount ?? 0} docs · {getVisibilityLabel(f)}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Document panel */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {!selectedFolderId ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--color-text-secondary)', gap: 12 }}>
              <span style={{ fontSize: 48, opacity: 0.2 }}>📁</span>
              <p style={{ margin: 0, fontSize: 14 }}>Select a folder to view documents</p>
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                    {selectedFolder?.icon} {selectedFolder?.name}
                  </h2>
                  {selectedFolder?.description && (
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>{selectedFolder.description}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {isAdmin && (
                    <>
                      <button onClick={() => setShowUploadModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                        <IconPlus size={13} /> Upload
                      </button>
                      <button onClick={() => { if (confirm(`Archive "${selectedFolder?.name}"?`)) archiveMutation.mutate(selectedFolderId); }}
                        style={{ padding: '8px 12px', border: '1px solid var(--color-border)', background: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        Archive
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <IconSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…"
                  style={{ width: '100%', paddingLeft: 32, padding: '8px 12px 8px 32px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, background: 'var(--color-surface)', color: 'inherit', boxSizing: 'border-box' }} />
              </div>

              {/* Document cards */}
              {!filteredDocs.length ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border)', borderRadius: 12 }}>
                  {search ? 'No documents match your search.' : isAdmin ? 'Upload the first document to this folder.' : 'No documents in this folder yet.'}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                  {filteredDocs.map(d => (
                    <div key={d.id} style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 32, textAlign: 'center' }}>{fileIcon(d.fileType)}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{d.title}</div>
                        {d.description && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>{d.description}</div>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                        <div>{d.fileName}</div>
                        <div>{fmtSize(d.fileSize)} · v{d.version}</div>
                        <div>Uploaded {fmtDate(d.createdAt)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                        <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${d.downloadUrl}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', background: 'var(--color-primary)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
                          <IconDownload size={13} /> Download
                        </a>
                        {isAdmin && (
                          <button onClick={() => { if (confirm('Delete this document?')) deleteMutation.mutate(d.id); }}
                            style={{ padding: '7px 10px', border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', borderRadius: 8, cursor: 'pointer' }}>
                            <IconTrash size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
