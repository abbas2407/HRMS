import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { IconCpu, IconRefresh, IconPlug, IconPlus, IconTrash, IconUserCheck, IconCheck, IconX } from '@tabler/icons-react';

type Tab = 'devices' | 'enrollment';

export default function BiometricDevicesPage() {
  const [tab, setTab] = useState<Tab>('devices');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedUid, setSelectedUid] = useState<string>('');

  // Device Form state
  const [name, setName] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState(4370);
  const [deviceSerial, setDeviceSerial] = useState('');

  const qc = useQueryClient();

  // Queries
  const { data: devices, isLoading: loadingDevices } = useQuery({
    queryKey: ['biometric-devices'],
    queryFn: () => api.get('/biometric/devices').then(r => r.data.data),
  });

  const { data: enrollments, isLoading: loadingEnrollments } = useQuery({
    queryKey: ['biometric-enrollments', selectedDevice],
    queryFn: () => api.get('/biometric/enrollments', { params: { deviceId: selectedDevice || undefined } }).then(r => r.data.data),
  });

  const { data: employeesList } = useQuery({
    queryKey: ['employees-list-all'],
    queryFn: () => api.get('/employees?limit=200').then(r => r.data.data),
  });

  const { data: deviceUsers, isFetching: loadingDeviceUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['biometric-device-users', selectedDevice],
    queryFn: () => api.get(`/biometric/devices/${selectedDevice}/users`).then(r => r.data.data),
    enabled: false,
  });

  // Mutations
  const addDeviceMutation = useMutation({
    mutationFn: () => api.post('/biometric/devices', { name, ipAddress, port, deviceSerial: deviceSerial || undefined }),
    onSuccess: () => {
      toast.success('Device added successfully');
      qc.invalidateQueries({ queryKey: ['biometric-devices'] });
      setAddOpen(false);
      setName(''); setIpAddress(''); setPort(4370); setDeviceSerial('');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to add device'),
  });

  const testConnectionMutation = useMutation({
    mutationFn: (deviceId: string) => api.post(`/biometric/devices/${deviceId}/test`),
    onSuccess: (res) => toast.success(res.data.message || 'Connection successful!'),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Connection failed'),
  });

  const syncNowMutation = useMutation({
    mutationFn: (deviceId: string) => api.post(`/biometric/devices/${deviceId}/sync`),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Sync completed!');
      qc.invalidateQueries({ queryKey: ['biometric-devices'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Sync failed'),
  });

  const enrollMutation = useMutation({
    mutationFn: () => api.post('/biometric/enroll', {
      deviceId: selectedDevice,
      employeeId: selectedEmployee,
      biometricUid: Number(selectedUid),
    }),
    onSuccess: () => {
      toast.success('Employee biometric mapped successfully');
      qc.invalidateQueries({ queryKey: ['biometric-enrollments'] });
      setSelectedEmployee(''); setSelectedUid('');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to map employee'),
  });

  const deleteEnrollmentMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/biometric/enroll/${id}`),
    onSuccess: () => {
      toast.success('Mapping removed');
      qc.invalidateQueries({ queryKey: ['biometric-enrollments'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete mapping'),
  });

  return (
    <div>
      <PageHeader
        title="Biometric Devices & Fingerprint Integration"
        breadcrumb={['Attendance', 'Biometric Devices']}
        actions={
          tab === 'devices' ? (
            <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setAddOpen(true)}>Add Device</Button>
          ) : null
        }
      />

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 20, display: 'flex', gap: 16 }}>
        <button
          onClick={() => setTab('devices')}
          style={{
            padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            color: tab === 'devices' ? 'var(--brand)' : 'var(--text-2)',
            borderBottom: tab === 'devices' ? '2px solid var(--brand)' : '2px solid transparent',
          }}
        >
          Device Management
        </button>
        <button
          onClick={() => setTab('enrollment')}
          style={{
            padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            color: tab === 'enrollment' ? 'var(--brand)' : 'var(--text-2)',
            borderBottom: tab === 'enrollment' ? '2px solid var(--brand)' : '2px solid transparent',
          }}
        >
          Employee Enrollment & Mapping
        </button>
      </div>

      {/* Devices Tab */}
      {tab === 'devices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loadingDevices ? (
            <Skeleton height={200} />
          ) : !(devices || []).length ? (
            <Card style={{ textAlign: 'center', padding: 48 }}>
              <IconCpu size={40} style={{ color: 'var(--text-3)', marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No Biometric Devices Configured</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, marginBottom: 16 }}>
                Add your ZKTeco or eSSL fingerprint devices to auto-sync office attendance punches.
              </div>
              <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setAddOpen(true)}>Add Device</Button>
            </Card>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)' }}>
                    {['Device Name', 'IP Address', 'Port', 'Serial No', 'Last Synced', 'Status', 'Actions'].map(h => (
                      <th key={h} className="th-label" style={{ padding: '10px 16px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(devices || []).map((d: any) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{d.name}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{d.ipAddress}</td>
                      <td style={{ padding: '12px 16px' }}>{d.port}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-3)' }}>{d.deviceSerial || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                        {d.lastSyncedAt ? new Date(d.lastSyncedAt).toLocaleString('en-IN') : 'Never'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant={d.isActive ? 'success' : 'gray'}>
                          {d.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button size="sm" icon={<IconPlug size={13} />} loading={testConnectionMutation.isPending} onClick={() => testConnectionMutation.mutate(d.id)}>
                            Test Connection
                          </Button>
                          <Button size="sm" variant="primary" icon={<IconRefresh size={13} />} loading={syncNowMutation.isPending} onClick={() => syncNowMutation.mutate(d.id)}>
                            Sync Now
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Enrollment Tab */}
      {tab === 'enrollment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card title="Map Hardware Biometric UID to Employee">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Select
                  label="Select Biometric Device"
                  placeholder="Select device"
                  value={selectedDevice}
                  onChange={e => setSelectedDevice(e.target.value)}
                  options={(devices || []).map((d: any) => ({ value: d.id, label: `${d.name} (${d.ipAddress})` }))}
                />
                <Select
                  label="Select Employee"
                  placeholder="Select employee"
                  value={selectedEmployee}
                  onChange={e => setSelectedEmployee(e.target.value)}
                  options={(employeesList || []).map((e: any) => ({ value: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeCode})` }))}
                />
                <Input
                  label="Device Biometric UID Number"
                  type="number"
                  placeholder="e.g. 101 or 1002"
                  value={selectedUid}
                  onChange={e => setSelectedUid(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Button
                  variant="primary"
                  icon={<IconUserCheck size={14} />}
                  loading={enrollMutation.isPending}
                  disabled={!selectedDevice || !selectedEmployee || !selectedUid}
                  onClick={() => enrollMutation.mutate()}
                >
                  Map Biometric UID
                </Button>
                {selectedDevice && (
                  <Button
                    icon={<IconRefresh size={14} />}
                    loading={loadingDeviceUsers}
                    onClick={() => refetchUsers()}
                  >
                    Fetch Device User List from Hardware
                  </Button>
                )}
              </div>

              {/* Hardware Device User List if fetched */}
              {deviceUsers && (
                <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Users Found on Hardware Device:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {deviceUsers.length === 0 ? (
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No users found on device</span>
                    ) : deviceUsers.map((u: any) => (
                      <div
                        key={u.userId || u.uid}
                        onClick={() => setSelectedUid(String(u.userId || u.uid))}
                        style={{
                          background: 'var(--bg-surface)', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer'
                        }}
                      >
                        <strong>UID #{u.userId || u.uid}</strong>: {u.name || 'Unnamed'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Enrolled mappings list */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 700 }}>
              Active Biometric UIDs Mapped ({enrollments?.length || 0})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  {['Employee Name', 'Code', 'Device', 'Biometric UID', 'Enrolled On', 'Action'].map(h => (
                    <th key={h} className="th-label" style={{ padding: '10px 16px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingEnrollments ? (
                  <tr><td colSpan={6} style={{ padding: 16 }}><Skeleton height={100} /></td></tr>
                ) : !(enrollments || []).length ? (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>No biometric mappings configured yet</td></tr>
                ) : (enrollments || []).map((e: any) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{e.firstName} {e.lastName}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{e.employeeCode}</td>
                    <td style={{ padding: '12px 16px' }}>{e.deviceName}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: 'var(--brand-l)', color: 'var(--brand)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                        UID #{e.biometricUid}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                      {new Date(e.enrolledAt).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<IconTrash size={13} />}
                        loading={deleteEnrollmentMutation.isPending}
                        onClick={() => { if (confirm('Delete biometric mapping?')) deleteEnrollmentMutation.mutate(e.id); }}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add ZKTeco / eSSL Biometric Device"
        footer={
          <>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={addDeviceMutation.isPending} onClick={() => addDeviceMutation.mutate()}>Add Device</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Device Name" placeholder="e.g. Main Entrance Gate" value={name} onChange={e => setName(e.target.value)} />
          <Input label="IP Address" placeholder="e.g. 192.168.1.201" value={ipAddress} onChange={e => setIpAddress(e.target.value)} />
          <Input label="Port Number" type="number" placeholder="4370" value={port} onChange={e => setPort(Number(e.target.value))} />
          <Input label="Device Serial Number (optional)" placeholder="e.g. ZK10293847" value={deviceSerial} onChange={e => setDeviceSerial(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
