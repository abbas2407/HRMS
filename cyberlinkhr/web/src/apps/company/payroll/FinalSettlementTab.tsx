import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconSearch, IconX, IconLock, IconLockOpen, IconPencil, IconTrash, IconDownload } from '@tabler/icons-react';

export default function FinalSettlementTab() {
  const qc = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<any>(null);

  // Form fields for Step 2
  const [formData, setFormData] = useState({
    resignationSubmittedOn: '2026-05-15',
    leavingDate: '2026-05-31',
    leavingReason: 'Resigned for better opportunities',
    remarks: 'Employee completed handover smoothly',
    netPay: 23611,
  });

  // Fetch settlements
  const { data: settlementsData, isLoading } = useQuery<any[]>({
    queryKey: ['final-settlements'],
    queryFn: () => api.get('/payroll/final-settlements', { params: { month: 5, year: 2026 } }).then(r => r.data.data),
  });

  // Fetch employees list for wizard search
  const { data: empList } = useQuery<any[]>({
    queryKey: ['employees-settlement-search'],
    queryFn: () => api.get('/employees').then(r => r.data.data),
    enabled: showWizard,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/payroll/final-settlements', {
        employeeId: selectedEmp.id,
        payoutMonth: 5,
        payoutYear: 2026,
        ...formData,
      }).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['final-settlements'] });
      setShowWizard(false);
      setWizardStep(1);
      setSelectedEmp(null);
      alert('Final settlement saved successfully!');
    },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to save settlement'),
  });

  const lockMutation = useMutation({
    mutationFn: (id: string) => api.put(`/payroll/final-settlements/${id}/lock`).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['final-settlements'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll/final-settlements/${id}`).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['final-settlements'] }),
  });

  const settlements = Array.isArray(settlementsData) ? settlementsData : [];

  const filteredEmployees = Array.isArray(empList)
    ? empList.filter(e =>
        `${e.firstName} ${e.lastName} ${e.employeeCode}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const fmtCurrency = (val: number | string) => {
    const n = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(n)) return '₹0.00';
    const absStr = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? `-₹${absStr}` : `₹${absStr}`;
  };

  const fmtDate = (d?: string) => {
    if (!d) return '31 May 2026';
    try {
      return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Info Banner */}
      <div style={{ background: '#f9fafb', padding: '12px 16px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, color: '#4b5563', lineHeight: 1.4 }}>
        The <strong>Final Settlement</strong> page helps you easily handle the settlement process when an employee separates from the organization. Click <strong>Settle Employee</strong> to perform the final settlement process of an employee. Once the settlement is processed, the settlement sheets are automatically generated and ready for delivery!
      </div>

      {/* Action & Filter Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: 8,
        padding: '12px 16px',
        border: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: 12, marginRight: 6 }}>Filter:</span>
            <select style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}>
              <option>May 2026</option>
              <option>Jun 2026</option>
              <option>Jul 2026</option>
            </select>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: 12, marginRight: 6 }}>Employee:</span>
            <select style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}>
              <option>All</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => {
            setShowWizard(true);
            setWizardStep(1);
          }}
          style={{
            padding: '8px 18px',
            borderRadius: 6,
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Settle Employee
        </button>
      </div>

      {/* Main Table (Image 1 Exact Layout) */}
      <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 24, color: '#6b7280' }}>Loading final settlements...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', width: 40 }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Payout Month</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Emp ID</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Employee Name</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Leaving Date</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Settlement Date</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Net Pay</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Processed On</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Lock / Unlock</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((item: any, idx: number) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{idx + 1}.</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>May 2026</td>
                  <td style={{ padding: '10px 12px', color: '#374151', fontWeight: 600 }}>{item.employeeCode}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>
                    {item.firstName} {item.lastName}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{fmtDate(item.leavingDate)}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>31 May 2026</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: item.netPay < 0 ? '#ef4444' : '#111827' }}>
                    {fmtCurrency(item.netPay)}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{fmtDate(item.processedAt)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <button
                      onClick={() => lockMutation.mutate(item.id)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: item.isLocked ? '#374151' : '#3b82f6' }}
                    >
                      {item.isLocked ? <IconLock size={15} /> : <IconLockOpen size={15} />}
                    </button>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563' }} title="Edit">
                        <IconPencil size={15} />
                      </button>
                      <button onClick={() => deleteMutation.mutate(item.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }} title="Delete">
                        <IconTrash size={15} />
                      </button>
                      <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb' }} title="Download Sheet">
                        <IconDownload size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ fontSize: 12, color: '#6b7280' }}>Total Items: {settlements.length}</div>

      {/* Settle Employee Wizard Modal (Image 2 & 3 Modified) */}
      {showWizard && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1500,
          padding: 20,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 8,
            width: '100%',
            maxWidth: 850,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          }}>
            {/* Wizard Header Breadcrumb / Stepper */}
            <div style={{ padding: '14px 20px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
                Home &gt; Payroll &gt; <strong style={{ color: '#111827' }}>Final Settlement</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, marginTop: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: wizardStep >= 1 ? '#22c55e' : '#d1d5db' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: wizardStep === 1 ? '#111827' : '#9ca3af' }}>
                    EMPLOYEE
                  </span>
                </div>

                <div style={{ height: 2, background: '#e5e7eb', flex: 1, maxWidth: 120 }} />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: wizardStep >= 2 ? '#22c55e' : '#d1d5db' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: wizardStep === 2 ? '#111827' : '#9ca3af' }}>
                    RESIGNATION DETAILS
                  </span>
                </div>
              </div>
            </div>

            {/* Wizard Content Body */}
            <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
              {wizardStep === 1 ? (
                /* Step 1: Employee Search (Image 2) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Step 1: Employee</h3>

                  <div style={{ fontSize: 13, color: '#4b5563' }}>
                    <strong>Start searching to see specific employee details here</strong>
                  </div>

                  <div style={{ maxWidth: 400, position: 'relative' }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                      Search Employee
                    </label>
                    {selectedEmp ? (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#eff6ff',
                        border: '1px solid #3b82f6',
                        borderRadius: 20,
                        padding: '4px 12px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#1d4ed8',
                      }}>
                        {selectedEmp.firstName} {selectedEmp.lastName} #{selectedEmp.employeeCode}
                        <button
                          onClick={() => setSelectedEmp(null)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#1d4ed8' }}
                        >
                          <IconX size={14} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <IconSearch size={16} style={{ position: 'absolute', left: 12, top: 10, color: '#9ca3af' }} />
                        <input
                          type="text"
                          placeholder="Search by Emp No/ Name"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px 8px 36px',
                            borderRadius: 20,
                            border: '1px solid #d1d5db',
                            fontSize: 13,
                          }}
                        />

                        {searchQuery.trim() !== '' && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                            zIndex: 100,
                            maxHeight: 180,
                            overflowY: 'auto',
                            marginTop: 4,
                          }}>
                            {filteredEmployees.map(emp => (
                              <div
                                key={emp.id}
                                onClick={() => {
                                  setSelectedEmp(emp);
                                  setSearchQuery('');
                                }}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  fontSize: 13,
                                  borderBottom: '1px solid #f3f4f6',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <span>{emp.firstName} {emp.lastName}</span>
                                <span style={{ color: '#6b7280' }}>#{emp.employeeCode}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Step 2: Resignation & Remarks Details (Modified Image 3 per instructions) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 500, margin: '0 auto' }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
                    Step 2: Resignation Details
                  </h3>

                  {/* Resignation Submitted On Date Picker */}
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Resignation Submitted On
                    </label>
                    <input
                      type="date"
                      value={formData.resignationSubmittedOn}
                      onChange={e => setFormData(f => ({ ...f, resignationSubmittedOn: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                      }}
                    />
                  </div>

                  {/* Leaving Date Picker */}
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Leaving Date
                    </label>
                    <input
                      type="date"
                      value={formData.leavingDate}
                      onChange={e => setFormData(f => ({ ...f, leavingDate: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                      }}
                    />
                  </div>

                  {/* Leaving Reason (Manual text / input dropdown) */}
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Leaving Reason
                    </label>
                    <input
                      type="text"
                      placeholder="Type leaving reason..."
                      value={formData.leavingReason}
                      onChange={e => setFormData(f => ({ ...f, leavingReason: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                      }}
                    />
                  </div>

                  {/* Remarks (Admin notes) */}
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Remarks
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Admin remarks about employee..."
                      value={formData.remarks}
                      onChange={e => setFormData(f => ({ ...f, remarks: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Footer Controls */}
            <div style={{
              padding: '12px 20px',
              background: '#f9fafb',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <button
                disabled={wizardStep === 1}
                onClick={() => setWizardStep(1)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: wizardStep === 1 ? '#9ca3af' : '#374151',
                  cursor: wizardStep === 1 ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                }}
              >
                &larr; Previous
              </button>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowWizard(false)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    color: '#374151',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                {wizardStep === 1 ? (
                  <button
                    disabled={!selectedEmp}
                    onClick={() => setWizardStep(2)}
                    style={{
                      padding: '6px 18px',
                      borderRadius: 6,
                      background: selectedEmp ? '#2563eb' : '#93c5fd',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: selectedEmp ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Next &rarr;
                  </button>
                ) : (
                  /* Final Step has Save Button instead of Next per instructions */
                  <button
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending}
                    style={{
                      padding: '6px 20px',
                      borderRadius: 6,
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {createMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
