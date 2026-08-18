import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import {
  IconFileText, IconPlus, IconSearch, IconX, IconDownload, IconTrash,
  IconCheck, IconUpload, IconFileCheck, IconUser,
} from '@tabler/icons-react';

export default function EmployeeDocumentsPage() {
  const [employeeType, setEmployeeType] = useState('ALL');
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Tabs & filters
  const [activeTab, setActiveTab] = useState<'documents' | 'letters' | 'payslip' | 'form16' | 'policies' | 'forms'>('documents');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Add modal state
  const [addOpen, setAddOpen] = useState(false);
  const [documentName, setDocumentName] = useState('');
  const [category, setCategory] = useState('Aadhaar');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [isPublished, setIsPublished] = useState(true);

  const qc = useQueryClient();

  // Fetch employees list for live search
  const { data: employeesList } = useQuery({
    queryKey: ['employees-search-list', employeeType],
    queryFn: () => api.get('/employees', {
      params: {
        status: employeeType === 'CURRENT' ? 'ACTIVE' : employeeType === 'RESIGNED' ? 'SEPARATED' : undefined,
        limit: 200,
      }
    }).then(r => r.data.data),
  });

  // Filtered employees by search string
  const filteredEmployees = (employeesList || []).filter((e: any) => {
    const q = empSearch.toLowerCase();
    const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
    const code = (e.employeeCode || '').toLowerCase();
    return fullName.includes(q) || code.includes(q);
  });

  // Fetch documents for selected employee
  const { data: documents, isLoading: loadingDocs } = useQuery({
    queryKey: ['employee-documents', selectedEmployee?.id],
    queryFn: () => api.get('/documents', {
      params: { employeeId: selectedEmployee?.id }
    }).then(r => r.data.data),
    enabled: !!selectedEmployee?.id,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: () => api.post('/documents', {
      employeeId: selectedEmployee?.id,
      documentName,
      category,
      description: description || undefined,
      fileUrl,
      fileName: fileName || 'Uploaded Document',
      fileSize: fileSize || '100 KB',
      isPublished,
    }),
    onSuccess: () => {
      toast.success('Document uploaded successfully');
      qc.invalidateQueries({ queryKey: ['employee-documents'] });
      setAddOpen(false);
      setDocumentName(''); setDescription(''); setFileUrl(''); setFileName('');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to upload document'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      toast.success('Document deleted');
      qc.invalidateQueries({ queryKey: ['employee-documents'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete document'),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }
    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onloadend = () => {
      setFileUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Filtered documents list
  const filteredDocs = (documents || []).filter((d: any) => {
    if (categoryFilter !== 'ALL' && d.category !== categoryFilter) return false;
    if (statusFilter === 'PUBLISHED' && !d.isPublished) return false;
    if (statusFilter === 'DRAFT' && d.isPublished) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Employee Documents"
        breadcrumb={['HR', 'Employee Directory', 'Documents']}
      />

      {/* Top Search & Filter Card */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
            Start searching to see specific employee details here
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>Employee Type:</span>
              <Select
                value={employeeType}
                onChange={e => setEmployeeType(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All' },
                  { value: 'CURRENT', label: 'Current Employees' },
                  { value: 'RESIGNED', label: 'Resigned Employees' },
                ]}
                style={{ width: 180 }}
              />
            </div>
          </div>

          {/* Search Box / Selected Employee Chip */}
          <div style={{ position: 'relative', maxWidth: 400 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4 }}>Search Employee</div>

            {selectedEmployee ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 14px',
                borderRadius: 20, background: 'var(--brand-l)', border: '1px solid var(--brand)',
                color: 'var(--brand)', fontWeight: 600, fontSize: 13
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: 'var(--brand)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11
                }}>
                  {selectedEmployee.firstName?.[0]}
                </div>
                <span>{selectedEmployee.firstName} {selectedEmployee.lastName} (#{selectedEmployee.employeeCode})</span>
                <IconX
                  size={16}
                  style={{ cursor: 'pointer', marginLeft: 4 }}
                  onClick={() => setSelectedEmployee(null)}
                />
              </div>
            ) : (
              <div>
                <Input
                  placeholder="Search by Emp No / Name..."
                  value={empSearch}
                  onChange={e => { setEmpSearch(e.target.value); setDropdownOpen(true); }}
                  onFocus={() => setDropdownOpen(true)}
                />

                {dropdownOpen && empSearch && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
                    background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
                    maxHeight: 200, overflowY: 'auto', boxShadow: 'var(--shadow-md)'
                  }}>
                    {!filteredEmployees.length ? (
                      <div style={{ padding: 12, fontSize: 12, color: 'var(--text-3)' }}>No employees found</div>
                    ) : filteredEmployees.map((e: any) => (
                      <div
                        key={e.id}
                        onClick={() => { setSelectedEmployee(e); setDropdownOpen(false); setEmpSearch(''); }}
                        style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 13, display: 'flex',
                          alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-subtle)'
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-subtle)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11
                        }}>
                          {e.firstName?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{e.firstName} {e.lastName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>#{e.employeeCode} • {e.departmentName || 'No Dept'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Main Content Area when Employee Selected */}
      {selectedEmployee && (
        <div>
          {/* Submodule Tabs Bar */}
          <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 16, display: 'flex', gap: 16, overflowX: 'auto' }}>
            {[
              { id: 'documents', label: 'Documents' },
              { id: 'letters', label: 'Letters' },
              { id: 'payslip', label: 'Payslip' },
              { id: 'form16', label: 'Form 16' },
              { id: 'policies', label: 'Company Policies' },
              { id: 'forms', label: 'Forms' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, color: activeTab === t.id ? 'var(--brand)' : 'var(--text-2)',
                  borderBottom: activeTab === t.id ? '2px solid var(--brand)' : '2px solid transparent',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Action & Filters Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Select
                label="Category"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'Category: All' },
                  { value: 'Aadhaar', label: 'Aadhaar' },
                  { value: 'PAN', label: 'PAN' },
                  { value: 'Bank Details', label: 'Bank Details' },
                  { value: 'Educational', label: 'Educational' },
                  { value: 'Experience', label: 'Experience' },
                  { value: 'Other', label: 'Other' },
                ]}
              />
              <Select
                label="Status"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'Filter: All' },
                  { value: 'PUBLISHED', label: 'Published' },
                  { value: 'DRAFT', label: 'Draft' },
                ]}
              />
            </div>

            <Button
              variant="primary"
              icon={<IconPlus size={14} />}
              onClick={() => setAddOpen(true)}
            >
              Add Documents
            </Button>
          </div>

          {/* Documents Cards List */}
          {loadingDocs ? (
            <Skeleton height={200} />
          ) : !filteredDocs.length ? (
            <Card style={{ textAlign: 'center', padding: 48 }}>
              <IconFileText size={40} style={{ color: 'var(--text-3)', marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No Documents Uploaded</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, marginBottom: 16 }}>
                Upload Aadhaar, PAN, Bank account or other official credentials for {selectedEmployee.firstName}.
              </div>
              <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setAddOpen(true)}>
                Add Documents
              </Button>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredDocs.map((doc: any) => (
                <div
                  key={doc.id}
                  style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
                    padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-xs)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, background: 'rgba(244, 63, 94, 0.1)',
                      color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <IconFileText size={22} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{doc.documentName}</span>
                        <Badge variant={doc.isPublished ? 'success' : 'gray'}>
                          {doc.isPublished ? 'Published' : 'Draft'}
                        </Badge>
                        <span style={{ fontSize: 11, background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: 4, color: 'var(--text-3)' }}>
                          {doc.category}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
                        Uploaded on {new Date(doc.createdAt).toLocaleString('en-IN')} • {doc.fileName} ({doc.fileSize})
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <a href={doc.fileUrl} download={doc.fileName || 'document'} target="_blank" rel="noreferrer">
                      <Button size="sm" icon={<IconDownload size={13} />}>Download</Button>
                    </a>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<IconTrash size={13} />}
                      loading={deleteMutation.isPending}
                      onClick={() => { if (confirm('Delete this document?')) deleteMutation.mutate(doc.id); }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Documents Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Upload Employee Document"
        footer={
          <>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={createMutation.isPending}
              disabled={!documentName || !fileUrl}
              onClick={() => createMutation.mutate()}
            >
              Save Document
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--bg-subtle)', padding: '10px 12px', borderRadius: 6 }}>
            You can upload employee documents, such as certificates, awards, or mandatory IDs (Aadhaar, PAN, Bank).
          </div>

          {selectedEmployee && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Employee</label>
              <div style={{
                padding: '8px 12px', background: 'var(--brand-l)', border: '1px solid var(--brand)',
                borderRadius: 6, fontSize: 13, fontWeight: 600, color: 'var(--brand)'
              }}>
                {selectedEmployee.firstName} {selectedEmployee.lastName} [{selectedEmployee.employeeCode}]
              </div>
            </div>
          )}

          <Input
            label="Document Name *"
            placeholder="e.g. Aadhaar Card, PAN Card, Graduation Degree"
            value={documentName}
            onChange={e => setDocumentName(e.target.value)}
          />

          <Select
            label="Category *"
            value={category}
            onChange={e => setCategory(e.target.value)}
            options={[
              { value: 'Aadhaar', label: 'Aadhaar Card' },
              { value: 'PAN', label: 'PAN Card' },
              { value: 'Bank Details', label: 'Bank Account Passbook / Cheque' },
              { value: 'Educational', label: 'Educational Qualification Certificate' },
              { value: 'Experience', label: 'Relieving / Experience Letter' },
              { value: 'Other', label: 'Other Credentials' },
            ]}
          />

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Description (Optional)</label>
            <textarea
              rows={3}
              placeholder="Add optional notes or description..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg-base)'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Upload File *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{
                padding: '8px 16px', borderRadius: 6, border: '1px solid var(--brand)',
                background: 'var(--brand-l)', color: 'var(--brand)', cursor: 'pointer',
                fontWeight: 600, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6
              }}>
                <IconUpload size={15} />
                <span>Upload File</span>
                <input
                  type="file"
                  accept=".pdf,.xls,.xlsx,.doc,.docx,.txt,.ppt,.pptx,.gif,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
              {fileName && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{fileName} ({fileSize})</span>}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4 }}>
              Accepted formats: PDF, XLS, XLSX, DOC, DOCX, TXT, PPT, PPTX, GIF, JPG, PNG (Max 10MB)
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginTop: 4 }}>
            <input
              type="checkbox"
              checked={isPublished}
              onChange={e => setIsPublished(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
            />
            <span style={{ fontWeight: 500 }}>Publish to Employee Portal</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
