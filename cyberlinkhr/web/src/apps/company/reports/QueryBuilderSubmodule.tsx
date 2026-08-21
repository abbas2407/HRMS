import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  IconPlus, IconTrash, IconPlayerPlay, IconDownload,
  IconChevronRight, IconChevronLeft, IconChevronsRight, IconChevronsLeft,
  IconDeviceFloppy, IconX,
} from '@tabler/icons-react';

interface FieldOption {
  key: string;
  label: string;
  category: 'Personal' | 'Employment' | 'Contact' | 'Salary' | 'Bank';
}

const ALL_FIELDS: FieldOption[] = [
  // Personal
  { key: 'employeeCode', label: 'Employee Code', category: 'Personal' },
  { key: 'firstName', label: 'First Name', category: 'Personal' },
  { key: 'lastName', label: 'Last Name', category: 'Personal' },
  { key: 'gender', label: 'Gender', category: 'Personal' },
  { key: 'dob', label: 'Date of Birth', category: 'Personal' },
  { key: 'maritalStatus', label: 'Marital Status', category: 'Personal' },
  // Employment
  { key: 'departmentName', label: 'Department Name', category: 'Employment' },
  { key: 'designationName', label: 'Designation Name', category: 'Employment' },
  { key: 'status', label: 'Employee Status', category: 'Employment' },
  { key: 'joiningDate', label: 'Joining Date', category: 'Employment' },
  { key: 'separationDate', label: 'Separation Date', category: 'Employment' },
  { key: 'workLocation', label: 'Work Location', category: 'Employment' },
  // Contact
  { key: 'email', label: 'Work Email', category: 'Contact' },
  { key: 'phone', label: 'Phone Number', category: 'Contact' },
  { key: 'address', label: 'Address', category: 'Contact' },
  // Salary
  { key: 'currentGross', label: 'Current Gross Salary', category: 'Salary' },
  // Bank
  { key: 'bankName', label: 'Bank Name', category: 'Bank' },
  { key: 'bankAccount', label: 'Bank Account Number', category: 'Bank' },
  { key: 'bankIfsc', label: 'IFSC Code', category: 'Bank' },
  { key: 'panNumber', label: 'PAN Number', category: 'Bank' },
  { key: 'uanNumber', label: 'PF UAN Number', category: 'Bank' },
];

export default function QueryBuilderSubmodule() {
  const qc = useQueryClient();
  const [viewState, setViewState] = useState<'LIST' | 'WIZARD'>('LIST');
  const [step, setStep] = useState<number>(1); // 1: Choose Fields, 2: Sort Order, 3: Filter Criteria, 4: Results

  // Step 1 State: Dual listbox selection
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [availableSelected, setAvailableSelected] = useState<string[]>([]);
  const [outputSelected, setOutputSelected] = useState<string[]>([]);
  const [outputFields, setOutputFields] = useState<string[]>([
    'employeeCode', 'firstName', 'lastName', 'departmentName', 'designationName', 'email', 'status',
  ]);

  // Step 2 State: Sort orders
  const [sortOrders, setSortOrders] = useState<Array<{ field: string; direction: 'ASC' | 'DESC' }>>([
    { field: 'firstName', direction: 'ASC' },
  ]);

  // Step 3 State: Filter criteria
  const [filterCriteria, setFilterCriteria] = useState<Array<{ field: string; operator: string; value: string }>>([]);

  // Save Modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reportDesc, setReportDesc] = useState('');

  // Fetch saved reports list
  const { data: savedReports, isLoading: isSavedLoading } = useQuery<any[]>({
    queryKey: ['custom-reports-saved'],
    queryFn: () => api.get('/reports/query-builder/saved').then(r => r.data.data),
  });

  // Query execution results query
  const { data: queryResults, isLoading: isRunLoading, refetch: refetchRun } = useQuery<any[]>({
    queryKey: ['query-builder-run', outputFields, sortOrders, filterCriteria],
    queryFn: () =>
      api.post('/reports/query-builder/run', {
        selectedFields: outputFields,
        sortOrders,
        filterCriteria,
      }).then(r => r.data.data),
    enabled: viewState === 'WIZARD' && step === 4,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post('/reports/query-builder/saved', {
        name: reportName,
        description: reportDesc,
        selectedFields: outputFields,
        sortOrders,
        filterCriteria,
      }).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-reports-saved'] });
      setShowSaveModal(false);
      setViewState('LIST');
      alert('Custom report saved successfully!');
    },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to save report'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/reports/query-builder/saved/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-reports-saved'] }),
  });

  // Filter available fields by category and exclude already picked output fields
  const availableFieldsList = ALL_FIELDS.filter(f => {
    if (outputFields.includes(f.key)) return false;
    if (selectedCategory === 'ALL') return true;
    return f.category === selectedCategory;
  });

  // Transfer controls
  const moveRight = () => {
    setOutputFields(prev => [...prev, ...availableSelected]);
    setAvailableSelected([]);
  };

  const moveLeft = () => {
    setOutputFields(prev => prev.filter(k => !outputSelected.includes(k)));
    setOutputSelected([]);
  };

  const moveAllRight = () => {
    const keysToAdd = availableFieldsList.map(f => f.key);
    setOutputFields(prev => Array.from(new Set([...prev, ...keysToAdd])));
    setAvailableSelected([]);
  };

  const moveAllLeft = () => {
    setOutputFields([]);
    setOutputSelected([]);
  };

  // CSV Export helper
  const exportToExcel = () => {
    if (!queryResults || queryResults.length === 0) return alert('No data to export');
    const headers = outputFields.map(k => ALL_FIELDS.find(f => f.key === k)?.label || k);
    const rows = queryResults.map(r => outputFields.map(k => r[k] ?? ''));
    const csvContent = [headers.join(','), ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${reportName || 'Custom_Report'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Banner Info Box (Exact text matching Screenshot) */}
      <div style={{ background: '#f9fafb', padding: '14px 18px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>
        The <strong>Create Custom Report</strong> wizard guides you through the process of creating/modifying a Query Builder report. In the first step, <strong>Choose Fields</strong>, you can select all the fields that are part of the report. Then in the <strong>Sort Order</strong> step, you can specify the sort order for the report. In the <strong>Filter Criteria</strong> step, you can specify the criteria for picking up the employee who will appear in the report. The <strong>Results</strong> step will generate the report and display the results. You can export the data into an Excel file from here.
        <br />
        If you <strong>Save</strong> the query, the Report will appear on the Query Builder list page, and you can regenerate this report anytime again.
      </div>

      {viewState === 'LIST' ? (
        /* Saved Custom Reports List Page */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 8,
            padding: '12px 16px',
            border: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
              Saved Custom Reports
            </h3>

            <button
              onClick={() => {
                setViewState('WIZARD');
                setStep(1);
                setReportName('');
                setReportDesc('');
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <IconPlus size={16} /> Create Custom Report
            </button>
          </div>

          <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', overflowX: 'auto' }}>
            {isSavedLoading ? (
              <div style={{ padding: 24, color: '#6b7280' }}>Loading saved reports...</div>
            ) : !savedReports || savedReports.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                No custom reports created yet. Click <strong>Create Custom Report</strong> to build your first report.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Report Name</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Fields Count</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Last Updated</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedReports.map((report: any) => (
                    <tr key={report.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#111827' }}>
                        {report.name}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#4b5563' }}>{report.description || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>
                        {Array.isArray(report.selectedFields) ? report.selectedFields.length : 0}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#6b7280' }}>
                        {new Date(report.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <button
                            onClick={() => {
                              setOutputFields(report.selectedFields || []);
                              setSortOrders(report.sortOrders || []);
                              setFilterCriteria(report.filterCriteria || []);
                              setReportName(report.name);
                              setReportDesc(report.description || '');
                              setViewState('WIZARD');
                              setStep(4);
                            }}
                            style={{
                              border: 'none',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '4px 10px',
                              borderRadius: 4,
                              fontWeight: 600,
                              fontSize: 11,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <IconPlayerPlay size={13} /> Run Report
                          </button>

                          <button
                            onClick={() => deleteMutation.mutate(report.id)}
                            style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                            title="Delete"
                          >
                            <IconTrash size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* 4-Step Custom Report Wizard View (Matching Screenshot Exact Structure) */
        <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Wizard Header Stepper */}
          <div style={{ padding: '16px 20px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 60 }}>
              {/* Step 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: step >= 1 ? '#22c55e' : '#d1d5db' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: step === 1 ? '#111827' : '#9ca3af', letterSpacing: 0.5 }}>
                  CHOOSE FIELDS
                </span>
              </div>
              <div style={{ height: 2, background: '#e5e7eb', width: 80 }} />

              {/* Step 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: step >= 2 ? '#22c55e' : '#d1d5db' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: step === 2 ? '#111827' : '#9ca3af', letterSpacing: 0.5 }}>
                  SORT ORDER
                </span>
              </div>
              <div style={{ height: 2, background: '#e5e7eb', width: 80 }} />

              {/* Step 3 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: step >= 3 ? '#22c55e' : '#d1d5db' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: step === 3 ? '#111827' : '#9ca3af', letterSpacing: 0.5 }}>
                  FILTER CRITERIA
                </span>
              </div>
              <div style={{ height: 2, background: '#e5e7eb', width: 80 }} />

              {/* Step 4 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: step >= 4 ? '#22c55e' : '#d1d5db' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: step === 4 ? '#111827' : '#9ca3af', letterSpacing: 0.5 }}>
                  RESULTS
                </span>
              </div>
            </div>
          </div>

          {/* Wizard Step Body */}
          <div style={{ padding: 24, flex: 1, minHeight: 350 }}>
            {step === 1 && (
              /* Step 1: Choose Fields Dual Listbox (Exact Screenshot Layout) */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: 16, alignItems: 'center' }}>
                {/* Available Fields Box */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#111827', display: 'block', marginBottom: 6 }}>
                    Available Fields
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, marginBottom: 8 }}
                  >
                    <option value="ALL">Select Category (All)</option>
                    <option value="Personal">Personal Details</option>
                    <option value="Employment">Employment & Department</option>
                    <option value="Contact">Contact Details</option>
                    <option value="Salary">Salary & Compensation</option>
                    <option value="Bank">Bank & Tax Details</option>
                  </select>

                  <select
                    multiple
                    value={availableSelected}
                    onChange={e => setAvailableSelected(Array.from(e.target.selectedOptions, o => o.value))}
                    style={{ width: '100%', height: 250, borderRadius: 4, border: '1px solid #d1d5db', padding: 8, fontSize: 12 }}
                  >
                    {availableFieldsList.map(f => (
                      <option key={f.key} value={f.key} style={{ padding: '4px 6px' }}>
                        {f.label} ({f.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Transfer Control Buttons (Middle Arrow Column) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                  <button onClick={moveRight} disabled={availableSelected.length === 0} style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
                    <IconChevronRight size={16} />
                  </button>
                  <button onClick={moveAllRight} style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
                    <IconChevronsRight size={16} />
                  </button>
                  <button onClick={moveLeft} disabled={outputSelected.length === 0} style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
                    <IconChevronLeft size={16} />
                  </button>
                  <button onClick={moveAllLeft} style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
                    <IconChevronsLeft size={16} />
                  </button>
                </div>

                {/* Output Fields Box */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#111827', display: 'block', marginBottom: 6 }}>
                    Output Fields ({outputFields.length} selected)
                  </label>
                  <div style={{ height: 31, marginBottom: 8 }} />
                  <select
                    multiple
                    value={outputSelected}
                    onChange={e => setOutputSelected(Array.from(e.target.selectedOptions, o => o.value))}
                    style={{ width: '100%', height: 250, borderRadius: 4, border: '1px solid #d1d5db', padding: 8, fontSize: 12 }}
                  >
                    {outputFields.map(key => {
                      const f = ALL_FIELDS.find(field => field.key === key);
                      return (
                        <option key={key} value={key} style={{ padding: '4px 6px' }}>
                          {f?.label || key}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}

            {step === 2 && (
              /* Step 2: Sort Order */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  Specify Report Sort Order
                </h4>
                {sortOrders.map((so, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <select
                      value={so.field}
                      onChange={e => {
                        const val = e.target.value;
                        setSortOrders(prev => prev.map((s, i) => (i === idx ? { ...s, field: val } : s)));
                      }}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}
                    >
                      {outputFields.map(k => (
                        <option key={k} value={k}>
                          {ALL_FIELDS.find(f => f.key === k)?.label || k}
                        </option>
                      ))}
                    </select>

                    <select
                      value={so.direction}
                      onChange={e => {
                        const dir = e.target.value as 'ASC' | 'DESC';
                        setSortOrders(prev => prev.map((s, i) => (i === idx ? { ...s, direction: dir } : s)));
                      }}
                      style={{ width: 140, padding: '6px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}
                    >
                      <option value="ASC">Ascending (A-Z)</option>
                      <option value="DESC">Descending (Z-A)</option>
                    </select>
                  </div>
                ))}
              </div>
            )}

            {step === 3 && (
              /* Step 3: Filter Criteria */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 700 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>
                    Specify Employee Filter Criteria
                  </h4>
                  <button
                    onClick={() => setFilterCriteria(prev => [...prev, { field: 'status', operator: 'EQUALS', value: 'ACTIVE' }])}
                    style={{ padding: '4px 10px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Add Filter Rule
                  </button>
                </div>

                {filterCriteria.length === 0 ? (
                  <div style={{ padding: 20, background: '#f9fafb', borderRadius: 6, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
                    No filter rules applied. All active and separated employees will be included in report.
                  </div>
                ) : (
                  filterCriteria.map((fc, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <select
                        value={fc.field}
                        onChange={e => {
                          const val = e.target.value;
                          setFilterCriteria(prev => prev.map((f, i) => (i === idx ? { ...f, field: val } : f)));
                        }}
                        style={{ width: 180, padding: '6px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}
                      >
                        {ALL_FIELDS.map(f => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </select>

                      <select
                        value={fc.operator}
                        onChange={e => {
                          const op = e.target.value;
                          setFilterCriteria(prev => prev.map((f, i) => (i === idx ? { ...f, operator: op } : f)));
                        }}
                        style={{ width: 140, padding: '6px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}
                      >
                        <option value="EQUALS">Equals</option>
                        <option value="CONTAINS">Contains</option>
                        <option value="NOT_EQUALS">Not Equals</option>
                        <option value="NOT_EMPTY">Is Not Empty</option>
                      </select>

                      <input
                        type="text"
                        placeholder="Value..."
                        value={fc.value}
                        onChange={e => {
                          const val = e.target.value;
                          setFilterCriteria(prev => prev.map((f, i) => (i === idx ? { ...f, value: val } : f)));
                        }}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}
                      />

                      <button
                        onClick={() => setFilterCriteria(prev => prev.filter((_, i) => i !== idx))}
                        style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {step === 4 && (
              /* Step 4: Results Table & Export */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>
                    Report Generated Results ({queryResults?.length || 0} records)
                  </h4>
                  <button
                    onClick={exportToExcel}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <IconDownload size={14} /> Export to Excel
                  </button>
                </div>

                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflowX: 'auto', maxHeight: 320 }}>
                  {isRunLoading ? (
                    <div style={{ padding: 24, color: '#6b7280' }}>Executing query...</div>
                  ) : !queryResults || queryResults.length === 0 ? (
                    <div style={{ padding: 24, color: '#6b7280', textAlign: 'center' }}>No matching records found</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left', width: 35 }}>#</th>
                          {outputFields.map(key => (
                            <th key={key} style={{ padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                              {ALL_FIELDS.find(f => f.key === key)?.label || key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResults.map((row: any, idx: number) => (
                          <tr key={row.id || idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px 10px', color: '#6b7280' }}>{idx + 1}.</td>
                            {outputFields.map(key => (
                              <td key={key} style={{ padding: '8px 10px', color: '#374151', whiteSpace: 'nowrap' }}>
                                {row[key] !== null && row[key] !== undefined ? String(row[key]) : '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Wizard Footer Controls (Matching Screenshot Exact Buttons: Previous, Next, Save Report, Close) */}
          <div style={{
            padding: '12px 20px',
            background: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <button
              disabled={step === 1}
              onClick={() => setStep(s => Math.max(1, s - 1))}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#fff',
                color: step === 1 ? '#9ca3af' : '#374151',
                cursor: step === 1 ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              &larr; Previous
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              {step < 4 && (
                <button
                  disabled={outputFields.length === 0}
                  onClick={() => setStep(s => Math.min(4, s + 1))}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 6,
                    background: outputFields.length > 0 ? '#2563eb' : '#93c5fd',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: outputFields.length > 0 ? 'pointer' : 'not-allowed',
                  }}
                >
                  Next &rarr;
                </button>
              )}

              <button
                onClick={() => setShowSaveModal(true)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  background: '#ffffff',
                  color: '#2563eb',
                  border: '1px solid #2563eb',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <IconDeviceFloppy size={14} /> Save Report
              </button>

              <button
                onClick={() => setViewState('LIST')}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  background: '#ffffff',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Custom Report Modal */}
      {showSaveModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1600,
          padding: 20,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 8,
            width: '100%',
            maxWidth: 450,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                Save Custom Query Report
              </h3>
              <button onClick={() => setShowSaveModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <IconX size={18} />
              </button>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                Report Name
              </label>
              <input
                type="text"
                placeholder="e.g. Active Employee Directory"
                value={reportName}
                onChange={e => setReportName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                Description
              </label>
              <textarea
                rows={3}
                placeholder="Brief description of this report..."
                value={reportDesc}
                onChange={e => setReportDesc(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                onClick={() => setShowSaveModal(false)}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 12 }}
              >
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!reportName.trim() || saveMutation.isPending}
                style={{
                  padding: '6px 18px',
                  borderRadius: 6,
                  background: reportName.trim() ? '#2563eb' : '#93c5fd',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: reportName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
