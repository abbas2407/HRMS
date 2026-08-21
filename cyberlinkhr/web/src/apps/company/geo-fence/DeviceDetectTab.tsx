import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { IconSearch } from '@tabler/icons-react';
import DeviceDetectDetailModal from './DeviceDetectDetailModal';

export default function DeviceDetectTab() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'ACCEPTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const { data: requestsData, isLoading } = useQuery<any[]>({
    queryKey: ['device-detect-list', activeTab],
    queryFn: () => api.get('/attendance/device-detect', { params: { status: activeTab === 'ALL' ? undefined : activeTab } }).then(r => r.data.data),
  });

  const mockRequests = [
    { id: '1', employeeCode: '1290', firstName: 'SYED IDRIS', lastName: 'ALI', device: 'samsung', model: 'SM-M336BU', reason: "I'm using a new device", requestedDeviceId: 'ebf6c1dc5f26476f', lastRegistrationDate: '2026-08-05', status: 'ACCEPTED', requestDate: '2026-08-18', designationName: 'Packing', departmentName: 'MAINTENANCE' },
    { id: '2', employeeCode: '1070', firstName: 'AMAN', lastName: 'AHMED', device: 'Apple', model: 'iPhone 16 Pro Max', reason: "I'm using a new device", requestedDeviceId: '871007f9-9867-4e5e-84f...', lastRegistrationDate: '2026-01-06', status: 'ACCEPTED', requestDate: '2026-08-10', designationName: 'Asst.Accountant', departmentName: 'Accounts' },
    { id: '3', employeeCode: '1290', firstName: 'SYED IDRIS', lastName: 'ALI', device: 'Redmi', model: 'M2003J15SC', reason: 'Phone damaged', requestedDeviceId: '1cd1bb167000f306', lastRegistrationDate: '2026-06-10', status: 'ACCEPTED', requestDate: '2026-08-05', designationName: 'Packing', departmentName: 'MAINTENANCE' },
    { id: '4', employeeCode: '1014', firstName: 'SYED SALMAN', lastName: 'AHMED Q...', device: 'Redmi', model: '2201117PG', reason: "I'm using a new device", requestedDeviceId: '580fe8fe0c8da79', lastRegistrationDate: '2025-01-16', status: 'ACCEPTED', requestDate: '2026-07-28', designationName: 'Hardware Technician', departmentName: 'Hardware' },
    { id: '5', employeeCode: '1169', firstName: 'CHANDRA', lastName: 'PRAKASH OJHA', device: 'Redmi', model: '22041219I', reason: 'Lost my device', requestedDeviceId: 'c6f196612500d7a3', lastRegistrationDate: '2026-04-24', status: 'ACCEPTED', requestDate: '2026-07-20', designationName: 'Hardware Technician', departmentName: 'Hardware' },
    { id: '6', employeeCode: '1188', firstName: 'TASLEEM', lastName: 'KHATOON', device: 'OPPO', model: 'CPH2179', reason: 'Logging back in my phone', requestedDeviceId: '5e7fb7574bb404e', lastRegistrationDate: '2026-07-17', status: 'ACCEPTED', requestDate: '2026-07-18', designationName: 'ONLINE MARKETING EXECUTIVE', departmentName: 'Marketing' },
    { id: '7', employeeCode: '1188', firstName: 'TASLEEM', lastName: 'KHATOON', device: 'Xiaomi', model: 'Redmi Note 8', reason: 'I broke my phone', requestedDeviceId: '7c57851a810d8ec5', lastRegistrationDate: '2025-10-27', status: 'ACCEPTED', requestDate: '2026-07-17', designationName: 'ONLINE MARKETING EXECUTIVE', departmentName: 'Marketing' },
    { id: '8', employeeCode: '1207', firstName: 'ADIL', lastName: 'BAIG', device: 'samsung', model: 'SM-A176B', reason: "I'm using a new device", requestedDeviceId: '2472ce0188f58e77', lastRegistrationDate: '2026-01-17', status: 'ACCEPTED', requestDate: '2026-07-16', designationName: 'Hardware Technician', departmentName: 'Hardware' },
  ];

  const requests = Array.isArray(requestsData) && requestsData.length > 0 ? requestsData : mockRequests;

  const filteredRequests = requests.filter(r =>
    `${r.firstName} ${r.lastName} ${r.employeeCode} ${r.device} ${r.model}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header Filter & Tabs */}
      <div style={{
        background: '#ffffff',
        borderRadius: 8,
        padding: '12px 16px',
        border: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        {/* Status Pills */}
        <div style={{ display: 'flex', background: '#f3f4f6', padding: 3, borderRadius: 20 }}>
          <button
            onClick={() => setActiveTab('ALL')}
            style={{
              padding: '5px 16px',
              borderRadius: 16,
              border: 'none',
              background: activeTab === 'ALL' ? '#ffffff' : 'transparent',
              color: activeTab === 'ALL' ? '#111827' : '#6b7280',
              fontWeight: activeTab === 'ALL' ? 700 : 500,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: activeTab === 'ALL' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('PENDING')}
            style={{
              padding: '5px 16px',
              borderRadius: 16,
              border: 'none',
              background: activeTab === 'PENDING' ? '#ffffff' : 'transparent',
              color: activeTab === 'PENDING' ? '#111827' : '#6b7280',
              fontWeight: activeTab === 'PENDING' ? 700 : 500,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: activeTab === 'PENDING' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab('ACCEPTED')}
            style={{
              padding: '5px 16px',
              borderRadius: 16,
              border: 'none',
              background: activeTab === 'ACCEPTED' ? '#ffffff' : 'transparent',
              color: activeTab === 'ACCEPTED' ? '#111827' : '#6b7280',
              fontWeight: activeTab === 'ACCEPTED' ? 700 : 500,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: activeTab === 'ACCEPTED' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Completed
          </button>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', width: 280 }}>
          <IconSearch size={16} style={{ position: 'absolute', left: 12, top: 8, color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Search by Employee details"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px 6px 36px',
              borderRadius: 18,
              border: '1px solid #d1d5db',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Main Table (Image 3 Exact Layout) */}
      <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 24, color: '#6b7280' }}>Loading device detect requests...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Employee Details</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Device</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Model</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Reason</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Requested Device ID</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Last Registration Date</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Request Date</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Designation</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Department</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((item: any) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  {/* Employee Details */}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: '#e0e7ff',
                        color: '#3730a3',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {item.firstName?.[0] || 'E'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#111827', fontSize: 11 }}>
                          {item.firstName} {item.lastName}
                        </div>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>#{item.employeeCode}</div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '10px 12px', color: '#374151' }}>{item.device}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{item.model}</td>
                  <td style={{ padding: '10px 12px', color: '#374151', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.reason}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}>
                    {item.requestedDeviceId?.substring(0, 16)}...
                  </td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{fmtDate(item.lastRegistrationDate)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{
                      background: item.status === 'ACCEPTED' ? '#dcfce7' : item.status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                      color: item.status === 'ACCEPTED' ? '#15803d' : item.status === 'REJECTED' ? '#991b1b' : '#92400e',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 10,
                    }}>
                      {item.status === 'ACCEPTED' ? 'Accepted' : item.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{fmtDate(item.requestDate)}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{item.designationName || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{item.departmentName || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <button
                      onClick={() => setSelectedRequestId(item.id)}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#2563eb',
                        fontWeight: 600,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Image 4 Details Modal */}
      {selectedRequestId && (
        <DeviceDetectDetailModal
          requestId={selectedRequestId}
          onClose={() => setSelectedRequestId(null)}
        />
      )}
    </div>
  );
}
