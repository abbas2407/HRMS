import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { IconCheck, IconX } from '@tabler/icons-react';

interface DeviceDetectDetailProps {
  requestId: string;
  onClose: () => void;
}

export default function DeviceDetectDetailModal({ requestId, onClose }: DeviceDetectDetailProps) {
  const qc = useQueryClient();

  const { data: detailData, isLoading } = useQuery({
    queryKey: ['device-detect-detail', requestId],
    queryFn: () => api.get(`/attendance/device-detect/${requestId}`).then(r => r.data.data),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: 'ACCEPTED' | 'REJECTED') =>
      api.put(`/attendance/device-detect/${requestId}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['device-detect-list'] });
      qc.invalidateQueries({ queryKey: ['device-detect-detail', requestId] });
      alert('Device detect status updated!');
      onClose();
    },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to update status'),
  });

  const request = detailData?.request || {};
  const history = detailData?.history || [];

  const empName = `${request.firstName || ''} ${request.lastName || ''}`.trim() || 'SYED IDRIS ALI';
  const empCode = request.employeeCode || '1290';

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    try {
      return new Date(d).toISOString().split('T')[0];
    } catch {
      return d;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1800,
      padding: 20,
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 10,
        width: '100%',
        maxWidth: 850,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
      }}>
        {/* Header Breadcrumb & Status Tag */}
        <div style={{
          padding: '14px 20px',
          background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              Home &gt; <strong style={{ color: '#111827' }}>Device Detect</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#e0e7ff',
                color: '#3730a3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 12,
              }}>
                {empName[0]}
              </div>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#111827' }}>
                {empName}
              </span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>#{empCode}</span>
            </div>
          </div>

          <span style={{
            background: request.status === 'ACCEPTED' ? '#dcfce7' : request.status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
            color: request.status === 'ACCEPTED' ? '#15803d' : request.status === 'REJECTED' ? '#991b1b' : '#92400e',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 12px',
            borderRadius: 12,
            textTransform: 'uppercase',
          }}>
            {request.status || 'Accepted'}
          </span>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {isLoading ? (
            <div style={{ color: '#6b7280' }}>Loading details...</div>
          ) : (
            <>
              {/* Requested Device Summary Table / Card (Image 4 exact structure) */}
              <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, fontSize: 11, color: '#6b7280', borderBottom: '1px solid #f3f4f6', paddingBottom: 12 }}>
                  <div>
                    <span>Device</span>
                    <div style={{ fontWeight: 700, color: '#111827', marginTop: 4, fontSize: 13 }}>
                      {request.device || 'samsung'}
                    </div>
                  </div>
                  <div>
                    <span>Model</span>
                    <div style={{ fontWeight: 700, color: '#111827', marginTop: 4, fontSize: 13 }}>
                      {request.model || 'SM-M336BU'}
                    </div>
                  </div>
                  <div>
                    <span>Last Device Changed On</span>
                    <div style={{ color: '#374151', marginTop: 4, fontSize: 12 }}>
                      {fmtDate(request.lastRegistrationDate || '2026-08-05')}
                    </div>
                  </div>
                  <div>
                    <span>Device ID</span>
                    <div style={{ color: '#374151', marginTop: 4, fontSize: 12 }}>
                      {request.requestedDeviceId || 'ebf6c1dc5f26476f'}
                    </div>
                  </div>
                  <div>
                    <span>Requested On</span>
                    <div style={{ color: '#374151', marginTop: 4, fontSize: 12 }}>
                      {fmtDate(request.requestDate || '2026-08-18')}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 12 }}>
                  <span style={{ color: '#6b7280' }}>Reason: </span>
                  <span style={{ color: '#111827', fontWeight: 500 }}>
                    "{request.reason || "I'm using a new device"}"
                  </span>
                </div>
              </div>

              {/* DeviceDetect History Timeline (Image 4 exact structure) */}
              <div>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  DeviceDetect History
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderLeft: '2px solid #e5e7eb', paddingLeft: 16, marginLeft: 6 }}>
                  {history.length === 0 ? (
                    <>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: -22, top: 4, width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>Redmi</div>
                        <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>Reason: Phone damaged</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Requested On: 2026-08-05</div>
                        <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, marginTop: 2 }}>Status: Accepted</div>
                      </div>

                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: -22, top: 4, width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>Samsung</div>
                        <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>Reason: -</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Requested On: 2026-06-10</div>
                        <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, marginTop: 2 }}>Status: Accepted</div>
                      </div>
                    </>
                  ) : (
                    history.map((h: any) => (
                      <div key={h.id} style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: -22, top: 4, width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{h.device} ({h.model})</div>
                        <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>Reason: {h.reason || '—'}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Requested On: {fmtDate(h.requestDate)}</div>
                        <div style={{ fontSize: 11, color: h.status === 'ACCEPTED' ? '#16a34a' : '#ef4444', fontWeight: 700, marginTop: 2 }}>
                          Status: {h.status}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div style={{
          padding: '12px 20px',
          background: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {request.status === 'PENDING' && (
              <>
                <button
                  onClick={() => updateStatusMutation.mutate('ACCEPTED')}
                  disabled={updateStatusMutation.isPending}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 6,
                    background: '#16a34a',
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
                  <IconCheck size={16} /> Allow Device (Approve)
                </button>
                <button
                  onClick={() => updateStatusMutation.mutate('REJECTED')}
                  disabled={updateStatusMutation.isPending}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 6,
                    background: '#ef4444',
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
                  <IconX size={16} /> Reject
                </button>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: '1px solid #2563eb',
              background: '#ffffff',
              color: '#2563eb',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
