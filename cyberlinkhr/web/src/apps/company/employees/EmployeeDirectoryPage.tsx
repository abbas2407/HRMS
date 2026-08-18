import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import Drawer from '@/components/ui/Drawer';
import AddEmployeeModal from './AddEmployeeModal';
import {
  IconPlus, IconSearch, IconUser, IconDownload, IconFilter, IconColumns,
  IconCopy, IconCheck, IconMail, IconPhone, IconChevronRight, IconChevronDown, IconRefresh, IconX,
} from '@tabler/icons-react';
import { toast } from '@/components/ui/Toast';

function AccordionFilterItem({
  title,
  options,
  selectedId,
  onSelect,
  onReset
}: {
  title: string;
  options: Array<{ id: string; label: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
  onReset?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '10px 14px', background: 'var(--bg-subtle)', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 13, fontWeight: 600, color: 'var(--text-1)'
        }}
      >
        <span>{expanded ? '▼' : '►'} {title}</span>
        {selectedId && (
          <span style={{ fontSize: 11, color: 'var(--brand)', background: 'var(--brand-l)', padding: '1px 6px', borderRadius: 4 }}>
            1 selected
          </span>
        )}
      </div>

      {expanded && (
        <div style={{ padding: 12, background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
          {options.length > 5 && (
            <input
              type="text"
              placeholder="Search..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%', padding: '4px 8px', fontSize: 12, borderRadius: 4,
                border: '1px solid var(--border)', marginBottom: 8, background: 'var(--bg-base)'
              }}
            />
          )}

          <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(opt => (
              <label
                key={opt.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={selectedId === opt.id}
                  onChange={() => onSelect(selectedId === opt.id ? '' : opt.id)}
                  style={{ width: 15, height: 15, accentColor: 'var(--brand)' }}
                />
                <span style={{ color: selectedId === opt.id ? 'var(--brand)' : 'var(--text-2)', fontWeight: selectedId === opt.id ? 600 : 400 }}>
                  {opt.label}
                </span>
              </label>
            ))}
          </div>

          {onReset && selectedId && (
            <div
              onClick={onReset}
              style={{ fontSize: 11, color: 'var(--brand)', marginTop: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              Reset
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EmployeeDirectoryPage() {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [desigFilter, setDesigFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);

  // Drawers
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [columnsDrawerOpen, setColumnsDrawerOpen] = useState(false);

  // Column visibility state
  const [visibleCols, setVisibleCols] = useState({
    code: true,
    contact: true,
    department: true,
    designation: true,
    employmentStatus: true,
    employmentType: true,
    joiningDate: false,
    dob: false,
    location: false,
  });

  const qc = useQueryClient();

  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data.data),
  });

  const { data: desigs } = useQuery({
    queryKey: ['designations'],
    queryFn: () => api.get('/designations').then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['employee-directory', search, deptFilter, desigFilter, statusFilter, typeFilter, locationFilter, page],
    queryFn: () => api.get('/employees', {
      params: {
        search: search || undefined,
        departmentId: deptFilter || undefined,
        designationId: desigFilter || undefined,
        status: statusFilter || undefined,
        employmentType: typeFilter || undefined,
        workLocation: locationFilter || undefined,
        page,
        limit: 50,
      }
    }).then(r => r.data),
  });

  const employees = data?.data || [];
  const meta = data?.meta || { total: 0, totalPages: 1 };

  // Filter count badge
  const activeFilterCount = [deptFilter, desigFilter, statusFilter, typeFilter, locationFilter].filter(Boolean).length;

  const resetFilters = () => {
    setDeptFilter('');
    setDesigFilter('');
    setStatusFilter('');
    setTypeFilter('');
    setLocationFilter('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const exportCSV = () => {
    if (!employees.length) {
      toast.error('No employee records to export');
      return;
    }
    const headers = ['Employee Code', 'First Name', 'Last Name', 'Email', 'Phone', 'Department', 'Designation', 'Status', 'Employment Type', 'Joining Date'];
    const rows = employees.map((e: any) => [
      e.employeeCode,
      e.firstName,
      e.lastName,
      e.email || '',
      e.phone || '',
      e.departmentName || '',
      e.designationName || '',
      e.status || '',
      e.employmentType || '',
      e.joiningDate || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: any) => r.map((c: any) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Employee_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported Employee Directory CSV');
  };

  return (
    <div>
      <PageHeader
        title="Employee Directory"
        breadcrumb={['HR', 'Directory']}
        actions={
          <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setAddOpen(true)}>Add Employee</Button>
        }
      />

      {/* Search & Actions Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <Input
            placeholder="Search by employee name, no. or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            icon={<IconDownload size={15} />}
            onClick={exportCSV}
            title="Export CSV"
          >
            Export
          </Button>

          <Button
            icon={<IconColumns size={15} />}
            onClick={() => setColumnsDrawerOpen(true)}
            title="Customize Columns"
          >
            Columns
          </Button>

          <Button
            icon={<IconFilter size={15} />}
            variant={activeFilterCount > 0 ? 'primary' : 'default'}
            onClick={() => setFilterDrawerOpen(true)}
          >
            Filter {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>
        </div>
      </div>

      {/* Main Directory Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)' }}>
              <th className="th-label" style={{ padding: '12px 16px', textAlign: 'left' }}>Employee Details</th>
              {visibleCols.contact && <th className="th-label" style={{ padding: '12px 16px', textAlign: 'left' }}>Contact</th>}
              {visibleCols.department && <th className="th-label" style={{ padding: '12px 16px', textAlign: 'left' }}>Department</th>}
              {visibleCols.designation && <th className="th-label" style={{ padding: '12px 16px', textAlign: 'left' }}>Designation</th>}
              {visibleCols.employmentStatus && <th className="th-label" style={{ padding: '12px 16px', textAlign: 'left' }}>Employment Status</th>}
              {visibleCols.employmentType && <th className="th-label" style={{ padding: '12px 16px', textAlign: 'left' }}>Employment Type</th>}
              {visibleCols.joiningDate && <th className="th-label" style={{ padding: '12px 16px', textAlign: 'left' }}>Joining Date</th>}
              {visibleCols.dob && <th className="th-label" style={{ padding: '12px 16px', textAlign: 'left' }}>Birthday</th>}
              {visibleCols.location && <th className="th-label" style={{ padding: '12px 16px', textAlign: 'left' }}>Location</th>}
              <th className="th-label" style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} style={{ padding: 24 }}><Skeleton height={150} /></td></tr>
            ) : !employees.length ? (
              <tr>
                <td colSpan={10} style={{ padding: 48, textAlign: 'center' }}>
                  <IconUser size={40} style={{ color: 'var(--text-3)', marginBottom: 8 }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>No employees found</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Try adjusting search query or filters</div>
                </td>
              </tr>
            ) : employees.map((emp: any) => {
              const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase() || 'E';
              return (
                <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Employee details */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', background: 'var(--brand-l)', color: 'var(--brand)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13,
                        overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)'
                      }}>
                        {emp.photoUrl ? (
                          <img src={emp.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : initials}
                      </div>
                      <div>
                        <Link to={`/employees/${emp.id}`} style={{ fontWeight: 600, color: 'var(--text-1)', textDecoration: 'none' }}>
                          {emp.firstName} {emp.lastName}
                        </Link>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                          #{emp.employeeCode}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Contact */}
                  {visibleCols.contact && (
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {emp.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <IconMail size={13} style={{ color: 'var(--text-3)' }} />
                            <span style={{ color: 'var(--text-2)' }}>{emp.email}</span>
                            <IconCopy
                              size={12}
                              style={{ color: 'var(--text-3)', cursor: 'pointer' }}
                              onClick={() => copyToClipboard(emp.email)}
                              title="Copy email"
                            />
                          </div>
                        )}
                        {emp.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <IconPhone size={13} style={{ color: 'var(--text-3)' }} />
                            <span style={{ color: 'var(--text-3)', fontFamily: 'monospace' }}>{emp.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                  )}

                  {/* Department */}
                  {visibleCols.department && (
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                      {emp.departmentName || '—'}
                    </td>
                  )}

                  {/* Designation */}
                  {visibleCols.designation && (
                    <td style={{ padding: '12px 16px', color: 'var(--text-2)' }}>
                      {emp.designationName || '—'}
                    </td>
                  )}

                  {/* Employment Status */}
                  {visibleCols.employmentStatus && (
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={emp.status === 'ACTIVE' ? 'success' : emp.status === 'SEPARATED' ? 'danger' : 'gray'}>
                        {emp.status === 'SEPARATED' ? 'Resigned' : emp.status || 'Active'}
                      </Badge>
                    </td>
                  )}

                  {/* Employment Type */}
                  {visibleCols.employmentType && (
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 9px', borderRadius: 12, fontSize: 11.5, fontWeight: 600,
                        background: emp.employmentType === 'INTERN' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                        color: emp.employmentType === 'INTERN' ? '#d97706' : 'var(--brand)'
                      }}>
                        {emp.employmentType?.replace('_', ' ') || 'FULL TIME'}
                      </span>
                    </td>
                  )}

                  {/* Joining Date */}
                  {visibleCols.joiningDate && (
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                      {emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                  )}

                  {/* Birthday */}
                  {visibleCols.dob && (
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                      {emp.dob ? new Date(emp.dob).toLocaleDateString('en-IN') : '—'}
                    </td>
                  )}

                  {/* Location */}
                  {visibleCols.location && (
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                      {emp.workLocation || '—'}
                    </td>
                  )}

                  {/* Action */}
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <Link to={`/employees/${emp.id}`}>
                      <Button size="sm" icon={<IconChevronRight size={14} />}>View Profile</Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Showing {employees.length} of {meta.total || 0} employees
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span style={{ fontSize: 12, padding: '4px 8px', alignSelf: 'center' }}>Page {page} of {meta.totalPages || 1}</span>
            <Button size="sm" disabled={page >= (meta.totalPages || 1)} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </div>

      {/* Filter Drawer */}
      <Drawer open={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)} title="Filter Directory">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Department Accordion */}
          <AccordionFilterItem
            title="Department"
            options={(depts || []).map((d: any) => ({ id: d.id, label: d.name }))}
            selectedId={deptFilter}
            onSelect={id => setDeptFilter(id)}
          />

          {/* Designation Accordion */}
          <AccordionFilterItem
            title="Designation"
            options={(desigs || []).map((d: any) => ({ id: d.id, label: d.name }))}
            selectedId={desigFilter}
            onSelect={id => setDesigFilter(id)}
          />

          {/* Employment Status Accordion */}
          <AccordionFilterItem
            title="Employment Status"
            options={[
              { id: 'ACTIVE', label: 'Active' },
              { id: 'SEPARATED', label: 'Resigned' },
            ]}
            selectedId={statusFilter}
            onSelect={id => setStatusFilter(id)}
            onReset={() => setStatusFilter('')}
          />

          {/* Employment Type Accordion */}
          <AccordionFilterItem
            title="Employment Type"
            options={[
              { id: 'FULL_TIME', label: 'Full Time' },
              { id: 'CONTRACT', label: 'Contract' },
              { id: 'INTERN', label: 'Internship' },
            ]}
            selectedId={typeFilter}
            onSelect={id => setTypeFilter(id)}
            onReset={() => setTypeFilter('')}
          />

          {/* Location Filter */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Location</label>
            <input
              type="text"
              placeholder="Filter location..."
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg-base)'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button style={{ flex: 1 }} onClick={resetFilters}>Reset All</Button>
            <Button variant="primary" style={{ flex: 1 }} onClick={() => setFilterDrawerOpen(false)}>Apply Filters</Button>
          </div>
        </div>
      </Drawer>

      {/* Column Customizer Drawer */}
      <Drawer open={columnsDrawerOpen} onClose={() => setColumnsDrawerOpen(false)} title="Customize Columns">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
            Toggle visible columns in directory table:
          </div>

          {[
            { key: 'contact', label: 'Contact Info (Email & Phone)' },
            { key: 'department', label: 'Department' },
            { key: 'designation', label: 'Designation' },
            { key: 'employmentStatus', label: 'Employment Status' },
            { key: 'employmentType', label: 'Employment Type' },
            { key: 'joiningDate', label: 'Date of Joining' },
            { key: 'dob', label: 'Birthday' },
            { key: 'location', label: 'Work Location' },
          ].map(col => (
            <label key={col.key} style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13,
              padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-subtle)'
            }}>
              <input
                type="checkbox"
                checked={(visibleCols as any)[col.key]}
                onChange={e => setVisibleCols(prev => ({ ...prev, [col.key]: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
              />
              <span style={{ fontWeight: 500 }}>{col.label}</span>
            </label>
          ))}

          <Button variant="primary" style={{ marginTop: 16 }} onClick={() => setColumnsDrawerOpen(false)}>Done</Button>
        </div>
      </Drawer>

      {/* Add Employee Modal */}
      <AddEmployeeModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
