import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import PageHeader from '@/components/layout/PageHeader';
import Badge, { statusToBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { IconPencil, IconUserOff, IconUserCheck, IconMoneybag, IconPackage, IconFileText, IconTrash } from '@tabler/icons-react';
import DocumentsTab from './DocumentsTab';
import EmployeeTimeline from './EmployeeTimeline';

type Tab = 'personal' | 'employment' | 'payroll' | 'documents' | 'timeline' | 'assets' | 'letters' | 'history';

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('personal');
  const [editMode, setEditMode] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [separationDate, setSeparationDate] = useState('');
  const [newGross, setNewGross] = useState('');
  const [salaryFrom, setSalaryFrom] = useState('');

  const { data: emp, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => api.get(`/employees/${id}`).then(r => r.data.data),
  });

  const { data: salaryHistory } = useQuery({
    queryKey: ['employee-salary', id],
    queryFn: () => api.get(`/employees/${id}/salary`).then(r => r.data.data),
    enabled: tab === 'payroll',
  });

  const { data: empAssets } = useQuery({
    queryKey: ['employee-assets', id],
    queryFn: () => api.get(`/assets/employee/${id}`).then(r => r.data.data),
    enabled: tab === 'assets',
  });

  const { data: empLetters } = useQuery({
    queryKey: ['employee-letters', id],
    queryFn: () => api.get('/letters').then(r => (r.data.data as any[]).filter((l: any) => l.employeeId === id)),
    enabled: tab === 'letters',
  });

  const { data: historyList, refetch: refetchHistory } = useQuery<any[]>({
    queryKey: ['employee-history', id],
    queryFn: () => api.get(`/framework/versions/employees/${id}`).then(r => r.data.data),
    enabled: tab === 'history',
  });

  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data.data),
  });

  const { data: desigs } = useQuery({
    queryKey: ['designations'],
    queryFn: () => api.get('/designations').then(r => r.data.data),
  });

  const { register, handleSubmit, reset } = useForm<any>({
    values: emp,
  });

  const updateMutation = useMutation({
    mutationFn: (d: any) => api.put(`/employees/${id}`, d),
    onSuccess: () => {
      toast.success('Saved');
      qc.invalidateQueries({ queryKey: ['employee', id] });
      setEditMode(false);
    },
    onError: (e: any) => {
      const details = e.response?.data?.details;
      if (details?.fieldErrors) {
        const msg = Object.entries(details.fieldErrors)
          .map(([field, msgs]: any) => `${field}: ${msgs.join(', ')}`)
          .join('\n');
        toast.error(msg || 'Invalid input');
      } else {
        toast.error(e.response?.data?.error || 'Failed');
      }
    },
  });

  const statusMutation = useMutation({
    mutationFn: () => api.put(`/employees/${id}/status`, { status: newStatus, separationDate: separationDate || undefined }),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['employee', id] });
      qc.invalidateQueries({ queryKey: ['employee-stats'] });
      setStatusOpen(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/employees/${id}`),
    onSuccess: () => {
      toast.success('Employee deleted');
      qc.invalidateQueries({ queryKey: ['employees'] });
      navigate('/employees');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });

  const salaryMutation = useMutation({
    mutationFn: () => api.post(`/employees/${id}/salary`, {
      gross: Number(newGross),
      effectiveFrom: salaryFrom,
      reason: 'Manual update',
    }),
    onSuccess: () => {
      toast.success('Salary assigned');
      qc.invalidateQueries({ queryKey: ['employee-salary', id] });
      qc.invalidateQueries({ queryKey: ['employee', id] });
      setSalaryOpen(false);
      setNewGross('');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  if (isLoading) return <div style={{ padding: 24 }}><Skeleton height={300} /></div>;
  if (!emp) return <div style={{ padding: 24, color: 'var(--text-3)' }}>Employee not found</div>;

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    color: tab === t ? 'var(--brand)' : 'var(--text-2)',
    background: 'none', border: 'none',
    borderBottom: tab === t ? '2px solid var(--brand)' : '2px solid transparent',
  });

  const field = (label: string, value: any) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span className="form-label">{label}</span>
      <span style={{ fontSize: 13, color: value ? 'var(--text-1)' : 'var(--text-3)', fontWeight: value ? 500 : 400 }}>
        {value || '—'}
      </span>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={`${emp.firstName} ${emp.lastName}`}
        breadcrumb={['HR', 'Employees', `${emp.firstName} ${emp.lastName}`]}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {!editMode && <Button icon={<IconPencil size={14} />} onClick={() => setEditMode(true)}>Edit</Button>}
            {!editMode && <Button variant="default" onClick={() => window.open(`${api.defaults.baseURL}/framework/print/employees/${id}`, '_blank')}>Print Profile</Button>}
            {editMode && <>
              <Button onClick={() => { setEditMode(false); reset(emp); }}>Cancel</Button>
              <Button variant="primary" loading={updateMutation.isPending} onClick={handleSubmit(d => updateMutation.mutate(d))}>Save</Button>
            </>}
            <Button
              icon={emp.status === 'ACTIVE' ? <IconUserOff size={14} /> : <IconUserCheck size={14} />}
              variant={emp.status === 'ACTIVE' ? 'danger' : 'primary'}
              onClick={() => { setNewStatus(emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'); setStatusOpen(true); }}
            >
              {emp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </Button>
            <Button
              icon={<IconTrash size={14} />}
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => { if (confirm(`Permanently delete ${emp.firstName} ${emp.lastName}? This cannot be undone.`)) deleteMutation.mutate(); }}
            >
              Delete
            </Button>
          </div>
        }
      />

      {/* Identity bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        {emp.photoUrl ? (
          <img src={emp.photoUrl} alt={`${emp.firstName} ${emp.lastName}`} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--brand)' }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {emp.firstName[0]}{emp.lastName[0]}
          </div>
        )}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{emp.firstName} {emp.lastName}</span>
            <Badge variant={statusToBadge(emp.status)}>{emp.status}</Badge>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {emp.employeeCode} · {emp.designationName || 'No designation'} · {emp.departmentName || 'No department'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Current Gross</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>
            {emp.currentGross ? `₹${Number(emp.currentGross).toLocaleString('en-IN')}` : '—'}
          </div>
          <Button size="sm" icon={<IconMoneybag size={12} />} onClick={() => { setNewGross(''); setSalaryFrom(''); setSalaryOpen(true); }} style={{ marginTop: 4 }}>
            Update Salary
          </Button>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 20, display: 'flex', flexWrap: 'wrap' }}>
        {(['personal', 'employment', 'payroll', 'documents', 'timeline', 'assets', 'letters', 'history'] as Tab[]).map(t => (
          <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Personal Tab */}
      {tab === 'personal' && (
        editMode ? (
          <Card title="Edit Personal Info">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Input label="First Name" {...register('firstName')} />
              <Input label="Last Name" {...register('lastName')} />
              <Input label="Work Email" type="email" {...register('email')} />
              <Input label="Phone" {...register('phone')} />
              <Input label="Emergency Contact" {...register('emergencyContact')} />
              <Select label="Marital Status" options={[
                { value: 'unmarried', label: 'Unmarried' },
                { value: 'married', label: 'Married' },
                { value: 'divorce', label: 'Divorce' },
              ]} {...register('maritalStatus')} />
              <Input label="Date of Birth" type="date" {...register('dob')} />
              <Select label="Gender" options={[{ value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }, { value: 'OTHER', label: 'Other' }]} {...register('gender')} />
              <Input label="Address" {...register('address')} />
              <Input label="Photo URL (base64/link)" {...register('photoUrl')} />
            </div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card title="Personal Info">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {field('First Name', emp.firstName)}
                {field('Last Name', emp.lastName)}
                {field('Email', emp.email)}
                {field('Phone', emp.phone)}
                {field('Emergency Contact', emp.emergencyContact)}
                {field('Marital Status', emp.maritalStatus ? emp.maritalStatus.charAt(0).toUpperCase() + emp.maritalStatus.slice(1) : null)}
                {field('Date of Birth', emp.dob ? new Date(emp.dob).toLocaleDateString('en-IN') : null)}
                {field('Gender', emp.gender)}
                {field('Address', emp.address)}
              </div>
            </Card>
            <Card title="Document Numbers">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {field('PAN Number (masked)', emp.panNumber)}
                {field('Aadhaar (masked)', emp.aadhaarNumber)}
                {emp.employmentType !== 'INTERN' && (
                  <>
                    {field('UAN Number (PF)', emp.uanNumber)}
                    {field('ESIC IP Number', emp.esicIpNumber)}
                  </>
                )}
                {emp.employmentType === 'INTERN' && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: 6 }}>
                    ℹ️ Statutory options (PF / ESIC) are excluded for Internship status.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )
      )}

      {/* Employment Tab */}
      {tab === 'employment' && (
        editMode ? (
          <Card title="Edit Employment Info">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Input label="Employee Code" {...register('employeeCode')} disabled />
              <Select label="Department" options={(depts || []).map((d: any) => ({ value: d.id, label: d.name }))} {...register('departmentId')} />
              <Select label="Designation" options={(desigs || []).map((d: any) => ({ value: d.id, label: d.name }))} {...register('designationId')} />
              <Select label="Employment Type / Status" options={[
                { value: 'FULL_TIME', label: 'Confirmed (Full Time)' },
                { value: 'CONTRACT', label: 'Consultant (Contract)' },
                { value: 'INTERN', label: 'Internship' },
                { value: 'PART_TIME', label: 'Part Time' },
              ]} {...register('employmentType')} />
              <div>
                <label className="form-label">Probation Period</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <Input type="number" placeholder="Days" {...register('probationDays')} />
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>days</span>
                </div>
              </div>
              <Input label="Joining Date" type="date" {...register('joiningDate')} />
              <Input label="Confirmation Date" type="date" {...register('confirmationDate')} />
              <Input label="Work Location" {...register('workLocation')} />
              <Input label="Grade" {...register('grade')} />
              <Input label="Cost Centre" {...register('costCentre')} />
              <Input label="Prior Experience (Months)" type="number" {...register('priorExperienceMonths')} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Input label="Shift Start Time (X)" placeholder="09:00" {...register('shiftStartTime')} />
                <Input label="Shift End Time (Y)" placeholder="18:00" {...register('shiftEndTime')} />
              </div>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card title="Employment Details">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {field('Employee Code', emp.employeeCode)}
                {field('Employment Type', emp.employmentType === 'INTERN' ? 'Internship' : emp.employmentType === 'CONTRACT' ? 'Consultant' : emp.employmentType?.replace('_', ' '))}
                {field('Probation Period', emp.probationDays ? `${emp.probationDays} days` : '—')}
                {field('Department', emp.departmentName)}
                {field('Designation', emp.designationName)}
                {field('Work Location', emp.workLocation)}
                {field('Grade', emp.grade)}
                {field('Shift Timing', (emp.shiftStartTime && emp.shiftEndTime) ? `${emp.shiftStartTime} to ${emp.shiftEndTime}` : '—')}
              </div>
            </Card>
            <Card title="Experience & Dates">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {field('Total Experience', (() => {
                  if (!emp.joiningDate) return '—';
                  const start = new Date(emp.joiningDate);
                  const end = emp.separationDate ? new Date(emp.separationDate) : new Date();
                  let years = end.getFullYear() - start.getFullYear();
                  let months = end.getMonth() - start.getMonth();
                  let days = end.getDate() - start.getDate();
                  if (days < 0) {
                    months -= 1;
                    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
                    days += prevMonth.getDate();
                  }
                  if (months < 0) {
                    years -= 1;
                    months += 12;
                  }
                  const prior = Number(emp.priorExperienceMonths || 0);
                  if (prior > 0) {
                    months += prior;
                    years += Math.floor(months / 12);
                    months = months % 12;
                  }
                  const parts = [];
                  if (years > 0) parts.push(`${years} yr${years > 1 ? 's' : ''}`);
                  if (months > 0) parts.push(`${months} mo${months > 1 ? 's' : ''}`);
                  if (days > 0 || parts.length === 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
                  return parts.join(' ');
                })())}
                {field('Joining Date', emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN') : null)}
                {field('Confirmation Date', emp.confirmationDate ? new Date(emp.confirmationDate).toLocaleDateString('en-IN') : null)}
                {field('Separation Date', emp.separationDate ? new Date(emp.separationDate).toLocaleDateString('en-IN') : null)}
                {emp.status === 'ACTIVE' && (
                  <Button variant="danger" size="sm" onClick={() => { setNewStatus('SEPARATED'); setSeparationDate(new Date().toISOString().split('T')[0]); setStatusOpen(true); }}>
                    Mark as Separated
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )
      )}

      {/* Payroll Tab */}
      {tab === 'payroll' && (
        <div>
          <Card title="Bank Account Details" style={{ marginBottom: 16 }}>
            {editMode ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Input label="Person Name (Account Holder)" {...register('bankAccountName')} />
                <Select label="Account Type" options={[
                  { value: 'SAVINGS', label: 'Savings' },
                  { value: 'CURRENT', label: 'Current' },
                  { value: 'SALARY', label: 'Salary' },
                ]} {...register('bankAccountType')} />
                <Input label="Bank Account Number" {...register('bankAccount')} />
                <Input label="IFSC Code" {...register('bankIfsc')} />
                <Input label="Bank Name" {...register('bankName')} />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                {field('Person Name', emp.bankAccountName)}
                {field('Account Type', emp.bankAccountType)}
                {field('Bank Account (masked)', emp.bankAccount)}
                {field('IFSC', emp.bankIfsc)}
                {field('Bank Name', emp.bankName)}
              </div>
            )}
          </Card>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Salary History</h3>
              <Button size="sm" icon={<IconMoneybag size={12} />} onClick={() => { setNewGross(''); setSalaryFrom(new Date().toISOString().split('T')[0]); setSalaryOpen(true); }}>+ Update</Button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  {['Gross Salary', 'Structure', 'Effective From', 'Reason'].map(h => (
                    <th key={h} className="th-label" style={{ padding: '8px 16px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!salaryHistory?.length ? (
                  <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No salary records</td></tr>
                ) : salaryHistory.map((s: any) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>₹{Number(s.gross).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12.5 }}>{s.structureName || 'Default'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>{new Date(s.effectiveFrom).toLocaleDateString('en-IN')}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)' }}>{s.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {tab === 'documents' && <DocumentsTab empId={id!} />}

      {/* Timeline Tab */}
      {tab === 'timeline' && <EmployeeTimeline empId={id!} />}

      {/* Assets Tab */}
      {tab === 'assets' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconPackage size={16} />
            <h3 style={{ margin: 0 }}>Assigned Assets</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)' }}>
                {['Code', 'Asset', 'Category', 'Assigned On', 'Returned On', 'Condition'].map(h => (
                  <th key={h} className="th-label" style={{ padding: '8px 16px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!(empAssets || []).length ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>No assets assigned</td></tr>
              ) : (empAssets || []).map((a: any) => (
                <tr key={a.assignmentId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>{a.assetCode}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{a.name}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-3)' }}>{a.category}</td>
                  <td style={{ padding: '10px 16px' }}>{a.assignedAt}</td>
                  <td style={{ padding: '10px 16px', color: a.returnedAt ? 'var(--text-2)' : 'var(--success)' }}>{a.returnedAt || 'In use'}</td>
                  <td style={{ padding: '10px 16px' }}>{a.condition || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Letters Tab */}
      {tab === 'letters' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconFileText size={16} />
            <h3 style={{ margin: 0 }}>HR Letters</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)' }}>
                {['Letter Type', 'Generated On'].map(h => (
                  <th key={h} className="th-label" style={{ padding: '8px 16px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!(empLetters || []).length ? (
                <tr><td colSpan={2} style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>No letters generated yet</td></tr>
              ) : (empLetters || []).map((l: any) => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{l.type}</span>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-3)' }}>
                    {new Date(l.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 700 }}>Version Audit History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!(historyList || []).length ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No revision history captured yet.</div>
            ) : (
              (historyList || []).map((v: any, index: number) => {
                const before = v.dataBefore || {};
                const after = v.dataAfter || {};
                const changedFields = Object.keys(after).filter(key => {
                  return JSON.stringify(before[key]) !== JSON.stringify(after[key]) && key !== 'updatedAt';
                });

                return (
                  <div key={v.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--bg-surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--border-s)', paddingBottom: 8 }}>
                      <div>
                        <strong style={{ fontSize: 13.5 }}>Revision #{historyList!.length - index}</strong>
                        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 8 }}>
                          {new Date(v.changedAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <Button size="sm" onClick={() => updateMutation.mutate(before)}>
                        Restore Version
                      </Button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {changedFields.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>No visible fields changed.</div>
                      ) : (
                        changedFields.map(field => (
                          <div key={field} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 2fr', gap: 8, fontSize: 12.5, alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{field}</span>
                            <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 4, textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {String(before[field] ?? '—')}
                            </span>
                            <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {String(after[field] ?? '—')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Status change modal */}
      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title="Change Employee Status"
        footer={
          <>
            <Button onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button variant={newStatus === 'ACTIVE' ? 'primary' : 'danger'} loading={statusMutation.isPending} onClick={() => statusMutation.mutate()}>
              Confirm
            </Button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Change status to: <strong>{newStatus}</strong>
          </div>
          {newStatus === 'SEPARATED' && (
            <Input label="Separation Date" type="date" value={separationDate} onChange={e => setSeparationDate(e.target.value)} />
          )}
        </div>
      </Modal>

      {/* Salary modal */}
      <Modal open={salaryOpen} onClose={() => setSalaryOpen(false)} title="Update Salary"
        footer={
          <>
            <Button onClick={() => setSalaryOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={salaryMutation.isPending} onClick={() => salaryMutation.mutate()}>Save</Button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="New Gross Salary (₹/month)" type="number" value={newGross} onChange={e => setNewGross(e.target.value)} />
          <Input label="Effective From" type="date" value={salaryFrom} onChange={e => setSalaryFrom(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
