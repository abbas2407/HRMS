import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconSearch, IconX, IconPencil, IconChevronRight, IconChevronDown } from '@tabler/icons-react';
import PayslipPreviewModal from './PayslipPreviewModal';

export default function PayrollSalaryTab() {
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('May 2026');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    netPay: true,
    gross: true,
    deductions: true,
  });

  // Fetch employees for search dropdown
  const { data: empList } = useQuery<any[]>({
    queryKey: ['employees-salary-search'],
    queryFn: () => api.get('/employees').then(r => r.data.data),
  });

  // Fetch detailed employee salary if selected
  const { data: salaryData, refetch: refetchSalary } = useQuery({
    queryKey: ['employee-salary-detail', selectedEmp?.id, selectedMonth],
    queryFn: () =>
      api.get('/payroll/employee-salary-detail', {
        params: { employeeId: selectedEmp.id, month: 5, year: 2026 },
      }).then(r => r.data.data),
    enabled: !!selectedEmp?.id,
  });

  const processMutation = useMutation({
    mutationFn: () =>
      api.post('/payroll/process-employee', {
        employeeId: selectedEmp.id,
        month: 5,
        year: 2026,
      }).then(r => r.data.data),
    onSuccess: () => {
      refetchSalary();
      alert('Payroll processed successfully!');
    },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to process payroll'),
  });

  const filteredEmps = Array.isArray(empList)
    ? empList.filter(e =>
        `${e.firstName} ${e.lastName} ${e.employeeCode}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const empDetails = salaryData?.employee || selectedEmp || {};
  const salDetails = salaryData?.salary || {};

  const fmt = (val: number | string | undefined) => {
    if (val === undefined || val === null) return '0.00';
    const n = typeof val === 'string' ? parseFloat(val) : val;
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Breadcrumb & Intro Text */}
      <div style={{ background: '#f9fafb', padding: '12px 16px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
          Home &gt; Payroll &gt; <strong style={{ color: '#111827' }}>Salary</strong>
        </div>
        <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.4 }}>
          The <strong>Salary</strong> page provides information on an employee's salary such as Net pay, Gross, Total deduction, and Loss of pay for the selected payroll month. The page enables you to add/revise an employee's salary, edit the values of salary components, and process the revised salary.
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: 8,
        padding: '16px 20px',
        border: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
          {/* Employee Type Dropdown */}
          <div style={{ minWidth: 160 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
              Employee Type
            </label>
            <select
              style={{
                width: '100%',
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: 13,
                background: '#fff',
              }}
            >
              <option>Current Employees</option>
              <option>All Employees</option>
              <option>Resigned Employees</option>
            </select>
          </div>

          {/* Employee Search Input / Selected Badge */}
          <div style={{ flex: 1, position: 'relative', minWidth: 260 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
              Search Employee
            </label>
            {selectedEmp ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                    {selectedEmp.firstName?.[0] || 'E'}
                  </div>
                  {selectedEmp.firstName} {selectedEmp.lastName} #{selectedEmp.employeeCode}
                  <button
                    onClick={() => setSelectedEmp(null)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#1d4ed8' }}
                  >
                    <IconX size={14} />
                  </button>
                </div>

                <span style={{ fontSize: 12, color: '#4b5563', background: '#f3f4f6', padding: '4px 10px', borderRadius: 4 }}>
                  Payroll Processed On 05 Jun 2026 7:03 PM
                </span>
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
                    outline: 'none',
                  }}
                />
                {/* Search Results Dropdown */}
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
                    maxHeight: 220,
                    overflowY: 'auto',
                    marginTop: 4,
                  }}>
                    {filteredEmps.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 13, color: '#6b7280' }}>No employee found</div>
                    ) : (
                      filteredEmps.map(emp => (
                        <div
                          key={emp.id}
                          onClick={() => {
                            setSelectedEmp(emp);
                            setSearchQuery('');
                          }}
                          style={{
                            padding: '8px 14px',
                            cursor: 'pointer',
                            fontSize: 13,
                            borderBottom: '1px solid #f3f4f6',
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#111827' }}>
                            {emp.firstName} {emp.lastName}
                          </span>
                          <span style={{ color: '#6b7280' }}>#{emp.employeeCode}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right side Month Selector */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
            Payroll Month
          </label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              fontSize: 13,
              background: '#fff',
            }}
          >
            <option>May '26</option>
            <option>Jun '26</option>
            <option>Jul '26</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {!selectedEmp ? (
        /* Image 2 Empty State */
        <div style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          padding: '60px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
            Start searching to see specific employee details here
          </h3>

          {/* Calculator Illustration */}
          <div style={{
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: '#f0f9ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            <div style={{
              width: 70,
              height: 90,
              background: '#3b82f6',
              borderRadius: 8,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              padding: 6,
              gap: 4,
            }}>
              <div style={{ height: 16, background: '#93c5fd', borderRadius: 4 }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, flex: 1 }}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} style={{ background: '#dbeafe', borderRadius: 2 }} />
                ))}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Get going!</div>
          <div style={{ fontSize: 13, color: '#6b7280', maxWidth: 400 }}>
            When you select an employee, salary details will show up here
          </div>
        </div>
      ) : (
        /* Image 3 Selected State */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Action Header Buttons (Top Right) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
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
              ✨ Tax Agent
            </button>
            <button
              onClick={() => setShowPreviewModal(true)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Preview Payslip
            </button>
            <button
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: '#ffffff',
                color: '#2563eb',
                border: '1px solid #2563eb',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Update Salary
            </button>
            <button
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {processMutation.isPending ? 'Processing...' : 'Process Payroll'}
            </button>
          </div>

          {/* 2 Column Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 20 }}>
            {/* Left Pane: Component Group breakdown accordion tree */}
            <div style={{
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px',
                background: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <input
                  type="text"
                  placeholder="Search by component"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    fontSize: 12,
                    width: 200,
                  }}
                />
                <button style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  Expand All
                </button>
              </div>

              <div style={{ padding: '8px 0', fontSize: 13 }}>
                {/* NET PAY */}
                <div style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <div
                    onClick={() => setExpanded(e => ({ ...e, netPay: !e.netPay }))}
                    style={{
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontWeight: 700,
                      color: '#111827',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {expanded.netPay ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                      NET PAY
                    </div>
                    <div>{fmt(salDetails.netPay || 48000)}</div>
                  </div>
                </div>

                {/* GROSS */}
                <div style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <div
                    onClick={() => setExpanded(e => ({ ...e, gross: !e.gross }))}
                    style={{
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontWeight: 700,
                      color: '#111827',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {expanded.gross ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                      GROSS
                    </div>
                    <div>{fmt(salDetails.grossSalary || 50000)}</div>
                  </div>
                </div>

                {/* TOTAL DEDUCTIONS */}
                <div style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <div
                    onClick={() => setExpanded(e => ({ ...e, deductions: !e.deductions }))}
                    style={{
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontWeight: 700,
                      color: '#111827',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {expanded.deductions ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                      TOTAL DEDUCTIONS
                    </div>
                    <div style={{ color: '#ef4444' }}>-{fmt(salDetails.totalDeductions || 2000)}</div>
                  </div>
                </div>

                {/* EMPLOYEE WORKDAYS */}
                <div style={{
                  padding: '10px 16px 10px 36px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f3f4f6',
                  color: '#374151',
                }}>
                  <span>EMPLOYEE WORKDAYS</span>
                  <span>{fmt(salDetails.workdays || 0)}</span>
                </div>

                {/* EMP EFFECTIVE WORKDAYS */}
                <div style={{
                  padding: '10px 16px 10px 36px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f3f4f6',
                  color: '#374151',
                }}>
                  <span>EMP EFFECTIVE WORKDAYS</span>
                  <span>{fmt(salDetails.effectiveDays || 31)}</span>
                </div>

                {/* DAYS IN MONTH */}
                <div style={{
                  padding: '10px 16px 10px 36px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f3f4f6',
                  color: '#374151',
                }}>
                  <span>DAYS IN MONTH</span>
                  <span>{fmt(salDetails.daysInMonth || 31)}</span>
                </div>

                {/* LOP */}
                <div style={{
                  padding: '10px 16px 10px 36px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #f3f4f6',
                  color: '#374151',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    LOP <IconPencil size={13} style={{ color: '#3b82f6', cursor: 'pointer' }} />
                  </span>
                  <span>{fmt(salDetails.lopDays || 0)}</span>
                </div>

                {/* EXTRA WORK DAYS */}
                <div style={{
                  padding: '10px 16px 10px 36px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: '#374151',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    EXTRA WORK DAYS <IconPencil size={13} style={{ color: '#3b82f6', cursor: 'pointer' }} />
                  </span>
                  <span>{fmt(salDetails.extraWorkDays || 0)}</span>
                </div>
              </div>
            </div>

            {/* Right Pane: Details Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              padding: 20,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827', borderBottom: '1px solid #e5e7eb', paddingBottom: 12 }}>
                Details
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
                <div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>Employee</div>
                  <div style={{ fontWeight: 700, color: '#111827', marginTop: 2 }}>
                    {empDetails.firstName || 'SYED'} {empDetails.lastName || 'RASHEED'}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>Join Date</div>
                  <div style={{ color: '#374151', marginTop: 2 }}>
                    {empDetails.joiningDate ? new Date(empDetails.joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '14 May 2021'}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>Date Of Birth</div>
                  <div style={{ color: '#374151', marginTop: 2 }}>
                    {empDetails.dob ? new Date(empDetails.dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '27 Aug 1984'} (41 Yrs 11 Months)
                  </div>
                </div>

                <div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>Location</div>
                  <div style={{ color: '#374151', marginTop: 2 }}>
                    {empDetails.workLocation || 'Hyderabad'}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>Bank & Compliance</div>
                  <div style={{ color: '#374151', marginTop: 2, fontSize: 12, lineHeight: 1.5 }}>
                    <div><strong>Bank:</strong> {empDetails.bankName || 'Kotak Mahindra Bank'}</div>
                    <div><strong>Account:</strong> {empDetails.bankAccount || '303010109866'}</div>
                    <div><strong>IFSC:</strong> {empDetails.bankIfsc || 'KKBK0000551'}</div>
                    <div><strong>PF UAN:</strong> {empDetails.uanNumber || '100513401762'}</div>
                    <div><strong>ESI:</strong> {empDetails.esicIpNumber || 'NA'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image 4 Payslip Preview Modal */}
      {showPreviewModal && (
        <PayslipPreviewModal
          data={{
            employeeCode: empDetails.employeeCode || selectedEmp?.employeeCode || '1011',
            firstName: empDetails.firstName || selectedEmp?.firstName || 'SYED',
            lastName: empDetails.lastName || selectedEmp?.lastName || 'RASHEED',
            departmentName: empDetails.departmentName || 'Accounts',
            designationName: empDetails.designationName || 'Sr. Accountant',
            joiningDate: empDetails.joiningDate || '2021-05-14',
            workLocation: empDetails.workLocation || 'Hyderabad',
            workingDays: salDetails.daysInMonth || 31,
            presentDays: salDetails.effectiveDays || 31,
            lopDays: salDetails.lopDays || 0,
            extraWorkDays: salDetails.extraWorkDays || 0,
            bankName: empDetails.bankName || 'Kotak Mahindra Bank',
            bankAccount: empDetails.bankAccount || '303010109866',
            bankIfsc: empDetails.bankIfsc || 'KKBK0000551',
            panNumber: empDetails.panNumber || 'CDFPR5535R',
            pfNumber: 'AP/HYD/2355789/000/0010011',
            uanNumber: empDetails.uanNumber || '100513401762',
            esicIpNumber: empDetails.esicIpNumber || '',
            month: 5,
            year: 2026,
            grossSalary: salDetails.grossSalary || 50000,
            basic: salDetails.basic || 25000,
            hra: salDetails.hra || 10000,
            specialAllowance: salDetails.specialAllowance || 10000,
            pfEmployee: 1800,
            professionalTax: 200,
            totalDeductions: salDetails.totalDeductions || 2000,
            netSalary: salDetails.netPay || 48000,
          }}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
}
