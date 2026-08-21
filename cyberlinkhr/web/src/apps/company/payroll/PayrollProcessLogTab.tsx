import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconCheck } from '@tabler/icons-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PayrollProcessLogTab() {
  const { data: logsData, isLoading } = useQuery<any[]>({
    queryKey: ['payroll-process-logs'],
    queryFn: () => api.get('/payroll/process-logs').then(r => r.data.data),
  });

  const logs = Array.isArray(logsData) ? logsData : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Title */}
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#374151' }}>
        Last 20 process log
      </h3>

      {/* Log Table */}
      <div style={{
        background: '#ffffff',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ padding: 24, color: '#6b7280' }}>Loading process logs...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#4b5563', width: '15%' }}>
                  Payroll
                </th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#4b5563', width: '65%' }}>
                  Description
                </th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: '#4b5563', width: '20%' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', color: '#111827', fontWeight: 500 }}>
                    {MONTH_NAMES[(log.month || 1) - 1]} {log.year}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#374151', lineHeight: 1.4 }}>
                    {log.description}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#059669',
                    }}>
                      <IconCheck size={14} /> COMPLETED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
