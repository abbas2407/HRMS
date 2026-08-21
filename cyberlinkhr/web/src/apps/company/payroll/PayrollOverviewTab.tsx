import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';

const MONTH_TABS = [
  { label: 'Apr 2026', month: 4, year: 2026, status: 'locked' },
  { label: 'May 2026', month: 5, year: 2026, status: 'locked' },
  { label: 'Jun 2026', month: 6, year: 2026, active: true },
  { label: 'Jul 2026', month: 7, year: 2026, status: 'locked' },
  { label: 'Aug 2026', month: 8, year: 2026, badge: 'New' },
  { label: 'Sep 2026', month: 9, year: 2026 },
  { label: 'Oct 2026', month: 10, year: 2026 },
  { label: 'Nov 2026', month: 11, year: 2026 },
  { label: 'Dec 2026', month: 12, year: 2026 },
  { label: 'Jan 2027', month: 1, year: 2027 },
  { label: 'Feb 2027', month: 2, year: 2027 },
  { label: 'Mar 2027', month: 3, year: 2027 },
];

export default function PayrollOverviewTab() {
  const [selectedTab, setSelectedTab] = useState(MONTH_TABS[2]);
  const [locks, setLocks] = useState({
    inputs: true,
    viewRelease: false,
    itStatement: true,
    payroll: true,
  });

  const { data: runsData } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs').then(r => r.data.data),
  });

  const { data: empList } = useQuery<any[]>({
    queryKey: ['employees-count'],
    queryFn: () => api.get('/employees').then(r => r.data.data),
  });
  const totalEmpCount = Array.isArray(empList) ? empList.length : 0;

  const currentRun = Array.isArray(runsData) ? runsData.find((r: any) => r.month === selectedTab.month && r.year === selectedTab.year) : null;

  const grossVal = currentRun?.totalGross ? parseFloat(currentRun.totalGross) : 0;
  const netVal = currentRun?.totalNet ? parseFloat(currentRun.totalNet) : 0;
  const dedVal = currentRun?.totalLop ? parseFloat(currentRun.totalLop) : 0;
  const workDays = 30;

  const fmtCurrency = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Description text */}
      <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
        Specific to that chosen payroll month. You can also view details related to the Net Payout Amount for the chosen payroll month.
      </div>

      {/* Month Selector Carousel / Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '6px 12px',
        overflowX: 'auto',
        gap: 6,
      }}>
        {MONTH_TABS.map((tab) => {
          const isSelected = selectedTab.label === tab.label;
          return (
            <button
              key={tab.label}
              onClick={() => setSelectedTab(tab)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                background: isSelected ? '#3b82f6' : 'transparent',
                color: isSelected ? '#ffffff' : '#374151',
                fontWeight: isSelected ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {tab.label}
              {tab.badge && (
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 8,
                  marginLeft: 4,
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Month Header */}
      <div style={{ background: '#eff6ff', padding: '16px 20px', borderRadius: 8, border: '1px solid #dbeafe' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e3a8a' }}>
          June {selectedTab.year}
        </h2>
        <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 4, fontStyle: 'italic' }}>
          Cutoff from 01 Jun {selectedTab.year} to 30 Jun {selectedTab.year} ✏️
        </div>
      </div>

      {/* 3 Main Summary Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {/* Card 1: Payout Details */}
        <div style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: 20,
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Payout Details</h3>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>
              {fmtCurrency(netVal)}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Net Pay</div>
          </div>

          {/* Simple CSS Donut Visualization */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'conic-gradient(#3b82f6 0% 70%, #60a5fa 70% 85%, #f87171 85% 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#fff' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', marginRight: 6 }} />
                <span style={{ fontWeight: 600, color: '#111827' }}>{fmtCurrency(grossVal)}</span>
                <div style={{ color: '#6b7280', fontSize: 11, marginLeft: 14 }}>Gross Pay</div>
              </div>
              <div>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f87171', marginRight: 6 }} />
                <span style={{ fontWeight: 600, color: '#111827' }}>{fmtCurrency(dedVal)}</span>
                <div style={{ color: '#6b7280', fontSize: 11, marginLeft: 14 }}>Deductions</div>
              </div>
              <div>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', marginRight: 6 }} />
                <span style={{ fontWeight: 600, color: '#111827' }}>{workDays}</span>
                <div style={{ color: '#6b7280', fontSize: 11, marginLeft: 14 }}>Work Days</div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Employee Details */}
        <div style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: 20,
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Employee Details</h3>
          <div style={{
            background: '#fef2f2',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #fee2e2',
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#991b1b' }}>{totalEmpCount}</div>
            <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>Total Employees</div>
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>Current Active Count</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            <div style={{ borderLeft: '3px solid #3b82f6', paddingLeft: 8 }}>
              <div style={{ fontWeight: 700, color: '#111827' }}>08</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>Addition</div>
            </div>
            <div style={{ borderLeft: '3px solid #10b981', paddingLeft: 8 }}>
              <div style={{ fontWeight: 700, color: '#111827' }}>06</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>Settlements</div>
            </div>
            <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: 8 }}>
              <div style={{ fontWeight: 700, color: '#111827' }}>00</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>Exclusion</div>
            </div>
            <div style={{ borderLeft: '3px solid #ef4444', paddingLeft: 8 }}>
              <div style={{ fontWeight: 700, color: '#111827' }}>04</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>Separation</div>
            </div>
          </div>
        </div>

        {/* Card 3: Action Controls */}
        <div style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: 20,
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Control item 1 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Payroll Inputs</span>
              <button
                onClick={() => setLocks(l => ({ ...l, inputs: !l.inputs }))}
                style={{
                  padding: '4px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: locks.inputs ? '#2563eb' : '#e5e7eb',
                  color: locks.inputs ? '#fff' : '#374151',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {locks.inputs ? 'Lock' : 'Unlock'}
              </button>
            </div>

            {/* Control item 2 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Employee View Release</span>
              <button
                onClick={() => setLocks(l => ({ ...l, viewRelease: !l.viewRelease }))}
                style={{
                  padding: '4px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: locks.viewRelease ? '#2563eb' : '#2563eb',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {locks.viewRelease ? 'Release' : 'Hold'}
              </button>
            </div>

            {/* Control item 3 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Update Payslips With Revised Employee Information</span>
              <button
                style={{
                  padding: '4px 14px',
                  borderRadius: 6,
                  border: '1px solid #2563eb',
                  background: '#fff',
                  color: '#2563eb',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Update
              </button>
            </div>

            {/* Control item 4 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>IT Statement Employee View</span>
              <button
                onClick={() => setLocks(l => ({ ...l, itStatement: !l.itStatement }))}
                style={{
                  padding: '4px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: locks.itStatement ? '#2563eb' : '#e5e7eb',
                  color: locks.itStatement ? '#fff' : '#374151',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {locks.itStatement ? 'Release' : 'Hold'}
              </button>
            </div>

            {/* Control item 5 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Payroll</span>
              <button
                onClick={() => setLocks(l => ({ ...l, payroll: !l.payroll }))}
                style={{
                  padding: '4px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: locks.payroll ? '#2563eb' : '#e5e7eb',
                  color: locks.payroll ? '#fff' : '#374151',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {locks.payroll ? 'Lock' : 'Unlock'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
