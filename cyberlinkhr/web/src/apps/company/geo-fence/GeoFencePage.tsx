import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  IconMapPin, IconShieldCheck, IconShieldOff, IconCircleCheck,
  IconCircleX, IconAlertTriangle, IconUser,
} from '@tabler/icons-react';

import DeviceDetectTab from './DeviceDetectTab';

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const today = toDateStr(new Date());
const weekAgo = toDateStr(new Date(Date.now() - 7 * 86_400_000));

export default function GeoFencePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'violations' | 'exempt' | 'device-detect'>('violations');
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);

  const { data: report, isLoading } = useQuery<{ noGpsPunches: any[]; exemptEmployees: any[] }>({
    queryKey: ['geo-report', from, to],
    queryFn: () => api.get(`/attendance/geo-report?from=${from}&to=${to}`).then(r => r.data.data),
    enabled: tab !== 'device-detect',
  });

  const { data: allEmployees = [] } = useQuery<any[]>({
    queryKey: ['employees-list'],
    queryFn: () => api.get('/employees').then(r => r.data.data),
    enabled: tab === 'exempt',
  });

  const toggleExemptMutation = useMutation({
    mutationFn: ({ id, isGeoExempt }: { id: string; isGeoExempt: boolean }) =>
      api.patch(`/employees/${id}/geo-exempt`, { isGeoExempt }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['geo-report', from, to] });
      qc.invalidateQueries({ queryKey: ['employees-list'] });
    },
  });

  const noGpsPunches = report?.noGpsPunches || [];
  const exemptEmployees = report?.exemptEmployees || [];

  const activeEmployees = (allEmployees as any[]).filter(e => e.status === 'ACTIVE');
  const exemptIds = new Set(exemptEmployees.map(e => e.id));

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <IconMapPin size={22} color="var(--color-primary)" />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Geo-fence Monitor</h1>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Punches without GPS location · Geo-exempt employees · Device Detect requests
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', width: 'fit-content', marginBottom: 22 }}>
        {([
          { key: 'violations', label: 'No-GPS Punches', icon: <IconAlertTriangle size={14} /> },
          { key: 'exempt', label: 'Exempt Employees', icon: <IconShieldCheck size={14} /> },
          { key: 'device-detect', label: 'Device Detect', icon: <IconUser size={14} /> },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
              border: 'none', background: tab === t.key ? 'var(--color-primary)' : 'none',
              color: tab === t.key ? '#fff' : 'inherit', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>
            {t.icon} {t.label}
            {t.key === 'violations' && noGpsPunches.length > 0 && (
              <span style={{ background: tab === 'violations' ? 'rgba(255,255,255,0.3)' : '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '1px 6px', marginLeft: 2 }}>
                {noGpsPunches.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'device-detect' && <DeviceDetectTab />}

      {/* ── VIOLATIONS TAB ── */}
      {tab === 'violations' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                style={{ padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, background: 'var(--color-surface)', color: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} max={today}
                style={{ padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, background: 'var(--color-surface)', color: 'inherit' }} />
            </div>
            <div style={{ alignSelf: 'flex-end', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              {isLoading ? 'Loading…' : `${noGpsPunches.length} record${noGpsPunches.length !== 1 ? 's' : ''}`}
            </div>
          </div>

          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '11px 16px', marginBottom: 18, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <IconAlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>These records show punches where the employee did not share their location. This may be due to GPS being denied, a remote punch, or the employee being geo-exempt.</span>
          </div>

          {!noGpsPunches.length ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
              <IconShieldCheck size={36} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
              No no-GPS punches in this period.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-surface)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    {['Employee', 'Date', 'Punch In', 'Punch Out', 'Status', 'Exempt', 'Source'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {noGpsPunches.map((r: any, idx: number) => (
                    <tr key={r.id} style={{ borderBottom: idx < noGpsPunches.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: 600 }}>{r.firstName} {r.lastName}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{r.employeeCode} · {r.departmentName || '—'}</div>
                      </td>
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>{fmtTime(r.punchIn)}</td>
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>{fmtTime(r.punchOut)}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                          background: r.status === 'PRESENT' ? '#f0fdf4' : r.status === 'LATE' ? '#fffbeb' : '#f1f5f9',
                          color: r.status === 'PRESENT' ? '#16a34a' : r.status === 'LATE' ? '#d97706' : '#64748b',
                        }}>
                          {r.status || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                        {r.isGeoExempt
                          ? <IconCircleCheck size={16} color="#22c55e" />
                          : <IconCircleX size={16} color="#94a3b8" />}
                      </td>
                      <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)', fontSize: 12 }}>{r.source || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── EXEMPT TAB ── */}
      {tab === 'exempt' && (
        <>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '11px 16px', marginBottom: 18, fontSize: 13, color: '#1d4ed8', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <IconShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Geo-exempt employees can punch in from any location. Use this for remote employees, executives, or field staff.</span>
          </div>

          <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-surface)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  {['Employee', 'Department', 'Geo-fence Status', 'Action'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!activeEmployees.length ? (
                  <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No active employees.</td></tr>
                ) : activeEmployees.map((emp: any, idx: number) => {
                  const exempt = exemptIds.has(emp.id) || emp.isGeoExempt;
                  return (
                    <tr key={emp.id} style={{ borderBottom: idx < activeEmployees.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <IconUser size={15} color="#fff" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{emp.firstName} {emp.lastName}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{emp.employeeCode}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', color: 'var(--color-text-secondary)' }}>{emp.departmentName || '—'}</td>
                      <td style={{ padding: '11px 14px' }}>
                        {exempt ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '3px 10px', borderRadius: 99 }}>
                            <IconShieldOff size={13} /> Exempt
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '3px 10px', borderRadius: 99 }}>
                            <IconShieldCheck size={13} /> Enforced
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <button
                          onClick={() => toggleExemptMutation.mutate({ id: emp.id, isGeoExempt: !exempt })}
                          disabled={toggleExemptMutation.isPending}
                          style={{
                            padding: '5px 14px', borderRadius: 7, border: `1px solid ${exempt ? '#fecaca' : 'var(--color-border)'}`,
                            background: exempt ? '#fef2f2' : 'none',
                            color: exempt ? '#dc2626' : 'var(--color-text-secondary)',
                            cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          }}>
                          {exempt ? 'Revoke Exemption' : 'Grant Exemption'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
