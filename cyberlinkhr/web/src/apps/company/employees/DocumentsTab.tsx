import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import Skeleton from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { IconUpload, IconDownload, IconTrash, IconCheck, IconX, IconAlertTriangle } from '@tabler/icons-react';

const DOC_TYPE_OPTIONS = [
  { value: 'AADHAAR', label: 'Aadhaar Card' },
  { value: 'PAN', label: 'PAN Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVING_LICENCE', label: 'Driving Licence' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'OFFER_LETTER', label: 'Offer Letter' },
  { value: 'APPOINTMENT_LETTER', label: 'Appointment Letter' },
  { value: 'SALARY_REVISION_LETTER', label: 'Salary Revision Letter' },
  { value: 'EXPERIENCE_LETTER', label: 'Experience Letter' },
  { value: 'RELIEVING_LETTER', label: 'Relieving Letter' },
  { value: 'EDUCATIONAL_CERTIFICATE', label: 'Educational Certificate' },
  { value: 'OTHER', label: 'Other' },
];

const DOC_LABEL: Record<string, string> = Object.fromEntries(DOC_TYPE_OPTIONS.map(o => [o.value, o.label]));

interface Props { empId: string; }

export default function DocumentsTab({ empId }: Props) {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [docType, setDocType] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const { data: checklist, isLoading: clLoading } = useQuery({
    queryKey: ['doc-checklist', empId],
    queryFn: () => api.get(`/documents/checklist/${empId}`).then(r => r.data.data),
  });

  const { data: docs, isLoading: docsLoading } = useQuery({
    queryKey: ['documents', empId],
    queryFn: () => api.get('/documents', { params: { employeeId: empId } }).then(r => r.data.data),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file || !docType) throw new Error('File and type required');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('docType', docType);
      if (expiryDate) fd.append('expiryDate', expiryDate);
      return api.post(`/documents/${empId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      toast.success('Document uploaded');
      qc.invalidateQueries({ queryKey: ['documents', empId] });
      qc.invalidateQueries({ queryKey: ['doc-checklist', empId] });
      setUploadOpen(false);
      setFile(null);
      setDocType('');
      setExpiryDate('');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.message || 'Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      toast.success('Document removed');
      qc.invalidateQueries({ queryKey: ['documents', empId] });
      qc.invalidateQueries({ queryKey: ['doc-checklist', empId] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const needsExpiry = (type: string) => ['PASSPORT', 'DRIVING_LICENCE'].includes(type);

  const daysUntilExpiry = (date: string) =>
    Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Required Docs Checklist */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3>Required Documents</h3>
          {clLoading ? <Skeleton height={20} width={60} /> : (
            <Badge variant={checklist?.completePct === 100 ? 'success' : 'warning'} dot={false}>
              {checklist?.completePct ?? 0}% complete
            </Badge>
          )}
        </div>
        {clLoading ? <Skeleton height={80} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {checklist?.checklist?.map((c: any) => (
              <div key={c.type} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, background: c.uploaded ? 'rgba(34,197,94,0.07)' : 'var(--bg-subtle)', border: `1px solid ${c.uploaded ? 'rgba(34,197,94,0.2)' : 'var(--border)'}` }}>
                {c.uploaded
                  ? <IconCheck size={14} color="var(--success)" />
                  : <IconX size={14} color="var(--danger)" />}
                <span style={{ fontSize: 12.5, color: 'var(--text-1)', fontWeight: 500 }}>{DOC_LABEL[c.type]}</span>
                {c.uploaded && <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
                  {new Date(c.uploadedAt).toLocaleDateString('en-IN')}
                </span>}
              </div>
            ))}
          </div>
        )}

        {/* Expiry alerts */}
        {checklist?.expiryAlerts?.length > 0 && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            {checklist.expiryAlerts.map((a: any) => {
              const days = daysUntilExpiry(a.expiryDate);
              return (
                <div key={a.type} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12 }}>
                  <IconAlertTriangle size={13} color={a.expired ? 'var(--danger)' : 'var(--warning)'} />
                  <span style={{ color: a.expired ? 'var(--danger)' : 'var(--warning)', fontWeight: 500 }}>
                    {DOC_LABEL[a.type]}: {a.expired ? 'EXPIRED' : `expires in ${days} day${days !== 1 ? 's' : ''}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Document List */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>All Documents ({docs?.length ?? 0})</h3>
          <Button size="sm" variant="primary" icon={<IconUpload size={12} />} onClick={() => setUploadOpen(true)}>Upload</Button>
        </div>

        {docsLoading ? (
          <div style={{ padding: 16 }}><Skeleton height={120} /></div>
        ) : !docs?.length ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            No documents uploaded yet
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)' }}>
                {['Type', 'File', 'Uploaded', 'Expiry', 'Actions'].map(h => (
                  <th key={h} className="th-label" style={{ padding: '8px 16px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map((d: any) => {
                const expDays = d.expiryDate ? daysUntilExpiry(d.expiryDate) : null;
                const expVariant = expDays !== null
                  ? expDays < 0 ? 'danger' : expDays <= 30 ? 'warning' : 'gray'
                  : 'gray';
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge variant="blue" dot={false}>
                        <span style={{ fontSize: 11 }}>{DOC_LABEL[d.docType] || d.docType}</span>
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.fileName} {d.fileSize ? `(${(d.fileSize / 1024).toFixed(0)} KB)` : ''}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                      {new Date(d.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {d.expiryDate ? (
                        <Badge variant={expVariant} dot={false}>
                          <span style={{ fontSize: 11 }}>{expDays! < 0 ? 'Expired' : expDays === 0 ? 'Today' : `${expDays}d`}</span>
                        </Badge>
                      ) : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <a href={d.downloadUrl} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" icon={<IconDownload size={12} />}>Download</Button>
                        </a>
                        <Button size="sm" variant="danger" icon={<IconTrash size={12} />}
                          loading={deleteMutation.isPending}
                          onClick={() => { if (confirm('Delete this document?')) deleteMutation.mutate(d.id); }}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Upload modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Document"
        footer={
          <>
            <Button onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
              disabled={!file || !docType}>
              Upload
            </Button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Select
            label="Document Type" required
            options={DOC_TYPE_OPTIONS}
            placeholder="Select type"
            value={docType}
            onChange={e => setDocType(e.target.value)}
          />
          {needsExpiry(docType) && (
            <div>
              <label className="form-label">Expiry Date</label>
              <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', marginTop: 4 }} />
            </div>
          )}
          <div>
            <label className="form-label">File (PDF, JPG, PNG — max 10 MB)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              style={{ marginTop: 6, fontSize: 13, width: '100%' }} />
          </div>
          {file && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--bg-subtle)', padding: '6px 10px', borderRadius: 6 }}>
              {file.name} — {(file.size / 1024).toFixed(0)} KB
            </div>
          )}
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', background: 'var(--bg-subtle)', padding: '8px 10px', borderRadius: 6 }}>
            Download links expire in 1 hour. Files are encrypted at rest.
          </div>
        </div>
      </Modal>
    </div>
  );
}
