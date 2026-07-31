import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { connectSocket, disconnectSocket } from '../../../lib/socket';
import { useAuthStore } from '../../../stores/auth.store';
import { IconLogin, IconLogout, IconClock } from '@tabler/icons-react';

function formatTime(d: string | Date | null): string {
  if (!d) return '--:--';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function timeSince(d: string | Date): string {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default function LiveBoardPage() {
  const qc = useQueryClient();
  const tenant = useAuthStore(s => s.tenant);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'live'],
    queryFn: () => api.get('/attendance/live').then(r => r.data.data),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!tenant?.schemaName) return;
    const socket = connectSocket(tenant.schemaName);

    socket.on('attendance:update', () => {
      setLastUpdate(new Date());
      qc.invalidateQueries({ queryKey: ['attendance', 'live'] });
    });

    return () => {
      socket.off('attendance:update');
    };
  }, [tenant?.schemaName, qc]);

  const punched: any[] = data?.punched || [];
  const notPunched: any[] = data?.notPunched || [];
  const total = data?.total || 0;
  const punchedCount = punched.length;
  const attendanceRate = total > 0 ? Math.round((punchedCount / total) * 100) : 0;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Live Attendance Board</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)' }}>
            Real-time punch status â€” {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Live Â· Updated {timeSince(lastUpdate)}
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Total Employees', value: total, color: 'var(--color-text)' },
          { label: 'Punched In', value: punchedCount, color: '#22c55e' },
          { label: 'Not Yet In', value: notPunched.length, color: '#ef4444' },
          { label: 'Attendance Rate', value: `${attendanceRate}%`, color: attendanceRate >= 80 ? '#22c55e' : '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Punched In */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconLogin size={16} style={{ color: '#22c55e' }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Punched In</span>
            <span style={{ marginLeft: 'auto', background: '#dcfce7', color: '#166534', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{punchedCount}</span>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div>
            ) : punched.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>No one has punched in yet</div>
            ) : punched.map((e: any) => (
              <div key={e.employeeId} style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {e.firstName?.[0]}{e.lastName?.[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.firstName} {e.lastName}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{e.departmentName || e.employeeCode}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{formatTime(e.punchIn)}</div>
                  {e.isLate && <div style={{ fontSize: 11, color: '#f59e0b' }}>+{e.lateByMinutes}m late</div>}
                  {e.punchOut && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Out: {formatTime(e.punchOut)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Not yet punched */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconLogout size={16} style={{ color: '#ef4444' }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Not Yet In</span>
            <span style={{ marginLeft: 'auto', background: '#fee2e2', color: '#991b1b', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{notPunched.length}</span>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div>
            ) : notPunched.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#22c55e', fontSize: 13, fontWeight: 600 }}>All employees have punched in!</div>
            ) : notPunched.map((e: any) => (
              <div key={e.employeeId} style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-border)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {e.firstName?.[0]}{e.lastName?.[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.firstName} {e.lastName}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{e.departmentName || e.employeeCode}</div>
                </div>
                <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>Absent</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}

