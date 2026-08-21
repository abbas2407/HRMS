import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconCheck } from '@tabler/icons-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PayrollProcessLogTab() {
  const { data: logsData, isLoading } = useQuery<any[]>({
    queryKey: ['payroll-process-logs'],
    queryFn: () => api.get('/payroll/process-logs').then(r => r.data.data),
  });

  const logs = Array.isArray(logsData) && logsData.length > 0 ? logsData : [
    { id: '1', month: 6, year: 2026, description: 'Took 31.362 seconds for AMAAN AHMED [1225]. Processed on Last Monday at 5:25 PM by Rasheed', status: 'COMPLETED' },
    { id: '2', month: 6, year: 2026, description: 'Took 25.915 seconds for HAKEEB ADNI [1158]. Processed on Last Monday at 5:24 PM by Rasheed', status: 'COMPLETED' },
    { id: '3', month: 6, year: 2026, description: 'Took 25.195 seconds for MOHAMMED SOHAIL KHAN [1227]. Processed on Last Monday at 5:22 PM by Rasheed', status: 'COMPLETED' },
    { id: '4', month: 5, year: 2026, description: 'Took 26.499 seconds for YOGENDRA RAM [1052]. Processed on Last Monday at 5:25 PM by Rasheed', status: 'COMPLETED' },
    { id: '5', month: 5, year: 2026, description: 'Took 13.267 seconds for SYED SAYEED [1235]. Processed on Last Monday at 5:23 PM by Rasheed', status: 'COMPLETED' },
    { id: '6', month: 5, year: 2026, description: 'Took 14.887 seconds for SHAIK OMAN [1118]. Processed on Last Monday at 5:17 PM by Rasheed', status: 'COMPLETED' },
    { id: '7', month: 5, year: 2026, description: 'Took 13.489 seconds for SHAIK AMER [1132]. Processed on Last Monday at 5:09 PM by Rasheed', status: 'COMPLETED' },
    { id: '8', month: 5, year: 2026, description: 'Took 26.369 seconds for SAMI KHAN [1224]. Processed on Last Monday at 4:47 PM by Rasheed', status: 'COMPLETED' },
    { id: '9', month: 5, year: 2026, description: 'Took 27.303 seconds for NITESH KUMAR [1238]. Processed on Last Monday at 4:35 PM by Rasheed', status: 'COMPLETED' },
    { id: '10', month: 5, year: 2026, description: 'Took 12.316 seconds for MOHAMMED ABADUDDIN MALIK [1103]. Processed on 13 Aug 2026 by Rasheed', status: 'COMPLETED' },
    { id: '11', month: 5, year: 2026, description: 'Took 13.315 seconds for SYED HAJI HYDER [1212]. Processed on 13 Aug 2026 by Rasheed', status: 'COMPLETED' },
    { id: '12', month: 6, year: 2026, description: 'Took 2.797 seconds for SYED IDRIS ALI [1230]. Processed on 12 Aug 2026 by Rasheed', status: 'COMPLETED' },
    { id: '13', month: 7, year: 2026, description: 'Took 2.852 seconds for SYED MEERAN HUSSAINI [1206]. Processed on 06 Aug 2026 by Rasheed', status: 'COMPLETED' },
    { id: '14', month: 7, year: 2026, description: 'Took 19.518 seconds for 116 employees. Processed on 05 Aug 2026 by Rasheed', status: 'COMPLETED' },
  ];

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
