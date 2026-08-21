import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconSearch, IconX, IconTrash } from '@tabler/icons-react';

export default function StopSalaryTab() {
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [reason, setReason] = useState('');

  // Fetch stopped salaries list
  const { data: stoppedData, isLoading } = useQuery<any[]>({
    queryKey: ['stop-salary'],
    queryFn: () => api.get('/payroll/stop-salary').then(r => r.data.data),
  });

  // Fetch employees list for search
  const { data: empList } = useQuery<any[]>({
    queryKey: ['employees-stop-search'],
    queryFn: () => api.get('/employees').then(r => r.data.data),
    enabled: showAddForm,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/payroll/stop-salary', {
        employeeId: selectedEmp.id,
        month: 5,
        year: 2026,
        reason,
        remarks: reason,
      }).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stop-salary'] });
      setShowAddForm(false);
      setSelectedEmp(null);
      setReason('');
      alert('Stop salary entry created successfully!');
    },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to create stop salary entry'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll/stop-salary/${id}`).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stop-salary'] }),
  });

  const stoppedList = Array.isArray(stoppedData) ? stoppedData : [];

  const filteredEmployees = Array.isArray(empList)
    ? empList.filter(e =>
        `${e.firstName} ${e.lastName} ${e.employeeCode}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Info Banner */}
      <div style={{ background: '#f9fafb', padding: '12px 16px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, color: '#4b5563', lineHeight: 1.4 }}>
        From the <strong>Stop Salary Processing</strong> page, you can stop processing the payroll for an employee. Click <strong>Add Stop Salary Processing</strong> to stop the payroll processing. This is usually done when an employee is on long leave without pay, absconding, on notice, or pending settlement. When you remove an employee from the list, the previous month's status is not affected and the employee continues to be on the stop-payment list for the previous months.
      </div>

      {!showAddForm ? (
        /* Image 4 Table View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Action Header */}
          <div style={{
            background: '#ffffff',
            borderRadius: 8,
            padding: '12px 16px',
            border: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <span style={{ color: '#6b7280', fontSize: 12, marginRight: 6 }}>Employee:</span>
              <select style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}>
                <option>All</option>
              </select>
            </div>

            <button
              onClick={() => setShowAddForm(true)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                background: '#ffffff',
                color: '#2563eb',
                border: '1px solid #2563eb',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Add Stop Salary Processing
            </button>
          </div>

          {/* Table */}
          <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', overflowX: 'auto', minHeight: 250 }}>
            {isLoading ? (
              <div style={{ padding: 24, color: '#6b7280' }}>Loading stopped salaries...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', width: 40 }}>#</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', width: '25%' }}>Employee No</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', width: '35%' }}>Name</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', width: '30%' }}>Remarks</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '10%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stoppedList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>
                        No employees currently on stop salary processing list
                      </td>
                    </tr>
                  ) : (
                    stoppedList.map((item: any, idx: number) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 12px', color: '#6b7280' }}>{idx + 1}.</td>
                        <td style={{ padding: '10px 12px', color: '#374151', fontWeight: 600 }}>{item.employeeCode}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>
                          {item.firstName} {item.lastName}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#4b5563' }}>{item.remarks || item.reason || '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            onClick={() => deleteMutation.mutate(item.id)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                            title="Remove"
                          >
                            <IconTrash size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
            <span>Total Items: {stoppedList.length}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ padding: '4px 14px', borderRadius: 4, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Save
              </button>
              <button style={{ padding: '4px 14px', borderRadius: 4, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Image 5 Form View */
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.4 }}>
            The <strong>Stop Salary Processing</strong> page enables you to stop the payroll processing for an employee. You can select the employee, put in a reason and click Save. Once done, the payroll for the current month is not processed for the selected employee.
          </div>

          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
            Start searching to see specific employee details here
          </div>

          {/* Employee Search Box */}
          <div style={{ maxWidth: 450, position: 'relative' }}>
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

          {/* Info Card (Image 5) */}
          <div style={{
            background: '#f9fafb',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            padding: 16,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            fontSize: 12,
            maxWidth: 600,
          }}>
            <div>
              <div style={{ color: '#6b7280', marginBottom: 2 }}>Join Date: <strong style={{ color: '#111827' }}>15 Jan 2021</strong></div>
              <div style={{ color: '#6b7280' }}>Payroll Month: <strong style={{ color: '#111827' }}>May 2026</strong></div>
            </div>
            <div>
              <div style={{ color: '#6b7280', marginBottom: 2 }}>Location: <strong style={{ color: '#111827' }}>Hyderabad</strong></div>
              <div style={{ color: '#6b7280' }}>Department: <strong style={{ color: '#111827' }}>Accounts</strong></div>
            </div>
          </div>

          {/* Text Area: Reason for stopping salary process */}
          <div style={{ maxWidth: 600 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
              Reason for stopping salary process
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Enter reason for stopping salary process..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: 13,
                resize: 'vertical',
              }}
            />
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!selectedEmp || createMutation.isPending}
              style={{
                padding: '6px 20px',
                borderRadius: 6,
                background: selectedEmp ? '#2563eb' : '#93c5fd',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: 13,
                cursor: selectedEmp ? 'pointer' : 'not-allowed',
              }}
            >
              {createMutation.isPending ? 'Saving...' : 'Save'}
            </button>

            <button
              onClick={() => {
                setShowAddForm(false);
                setSelectedEmp(null);
              }}
              style={{
                padding: '6px 20px',
                borderRadius: 6,
                background: '#ffffff',
                color: '#374151',
                border: '1px solid #d1d5db',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
