import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import {
  IconUsers, IconClock, IconCalendar, IconMoneybag,
  IconUserCheck, IconAlertCircle, IconTrendingUp, IconArrowRight,
  IconSpeakerphone, IconPin,
} from '@tabler/icons-react';

function StatCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        {icon && <div style={{ color: color || 'var(--color-primary)', opacity: 0.7 }}>{icon}</div>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || 'var(--color-text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function QuickLink({ to, icon, label, sub, color }: { to: string; icon: React.ReactNode; label: string; sub: string; color: string }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{sub}</div>
        </div>
        <IconArrowRight size={14} color="var(--color-text-secondary)" />
      </div>
    </Link>
  );
}

function fmt(v: string | null | undefined) {
  if (!v) return '₹0';
  return '₹' + parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const role = user?.role || 'EMPLOYEE';

  const { data, isLoading } = useQuery<any>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data.data),
    refetchInterval: 60_000, // refresh every minute
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const name = user?.email?.split('@')[0] || 'there';

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{greeting()}, {name} 👋</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading dashboard...</div>
      ) : data && (
        <>
          {/* KPI row */}
          {role === 'HR_ADMIN' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
              <StatCard label="Active Employees" value={data.headcount?.active ?? 0} icon={<IconUsers size={18} />} color="#3b82f6" />
              <StatCard label="Present Today" value={data.todayAttendance?.present ?? 0} sub={`${data.todayAttendance?.absent ?? 0} absent`} icon={<IconUserCheck size={18} />} color="#22c55e" />
              <StatCard label="Late Today" value={data.todayAttendance?.late ?? 0} icon={<IconClock size={18} />} color="#f59e0b" />
              <StatCard label="Pending Leaves" value={data.pendingLeaves ?? 0} sub="awaiting approval" icon={<IconAlertCircle size={18} />} color={data.pendingLeaves > 0 ? '#ef4444' : '#6b7280'} />
              {data.lastPayroll && (
                <StatCard
                  label={`Payroll (${data.lastPayroll.label})`}
                  value={fmt(data.lastPayroll.totalNet)}
                  sub={data.lastPayroll.status}
                  icon={<IconMoneybag size={18} />}
                  color="#8b5cf6"
                />
              )}
            </div>
          )}

          {role !== 'HR_ADMIN' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
              <StatCard label="Total Employees" value={data.headcount?.total ?? 0} icon={<IconUsers size={18} />} color="#3b82f6" />
              <StatCard label="Present Today" value={data.todayAttendance?.present ?? 0} icon={<IconUserCheck size={18} />} color="#22c55e" />
              <StatCard label="On Leave Today" value={data.todayAttendance?.onLeave ?? 0} icon={<IconCalendar size={18} />} color="#f59e0b" />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            {/* Quick links */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Access</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {role === 'HR_ADMIN' && <>
                  <QuickLink to="/employees" icon={<IconUsers size={18} />} label="Employees" sub="Manage team members" color="#3b82f6" />
                  <QuickLink to="/attendance/register" icon={<IconClock size={18} />} label="Attendance Register" sub="View daily attendance" color="#22c55e" />
                  <QuickLink to="/leaves" icon={<IconCalendar size={18} />} label="Leave Requests" sub={data.pendingLeaves > 0 ? `${data.pendingLeaves} pending approval` : 'No pending requests'} color="#f59e0b" />
                  <QuickLink to="/payroll" icon={<IconMoneybag size={18} />} label="Payroll Runs" sub="Run & manage payroll" color="#8b5cf6" />
                  <QuickLink to="/reports" icon={<IconTrendingUp size={18} />} label="Reports" sub="Analytics & exports" color="#06b6d4" />
                </>}
                {role === 'EMPLOYEE' && <>
                  <QuickLink to="/attendance/punch" icon={<IconClock size={18} />} label="Punch In / Out" sub="Record today's attendance" color="#22c55e" />
                  <QuickLink to="/leaves" icon={<IconCalendar size={18} />} label="Apply Leave" sub="Submit a leave request" color="#f59e0b" />
                  <QuickLink to="/leave-balance" icon={<IconCalendar size={18} />} label="Leave Balance" sub="Check your entitlements" color="#3b82f6" />
                  <QuickLink to="/payslips" icon={<IconMoneybag size={18} />} label="My Payslips" sub="View salary slips" color="#8b5cf6" />
                </>}
                {role === 'MANAGER' && <>
                  <QuickLink to="/attendance/punch" icon={<IconClock size={18} />} label="Punch In / Out" sub="Record attendance" color="#22c55e" />
                  <QuickLink to="/attendance/register" icon={<IconClock size={18} />} label="Team Attendance" sub="View team's attendance" color="#3b82f6" />
                  <QuickLink to="/leaves" icon={<IconCalendar size={18} />} label="Leave Approvals" sub="Approve / reject requests" color="#f59e0b" />
                </>}
              </div>
            </div>

            {/* Recent joiners */}
            {data.recentJoiners?.length > 0 && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Joiners (30 days)</div>
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                  {data.recentJoiners.map((e: any, i: number) => (
                    <Link key={e.id} to={`/employees/${e.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < data.recentJoiners.length - 1 ? '1px solid var(--color-border)' : undefined, cursor: 'pointer' }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--color-background)')}
                        onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#3b82f6', flexShrink: 0 }}>
                          {e.firstName[0]}{e.lastName[0]}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{e.firstName} {e.lastName}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Joined {e.joiningDate}</div>
                        </div>
                        <IconArrowRight size={13} color="var(--color-text-secondary)" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Announcements */}
          {data.announcements?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconSpeakerphone size={14} /> Announcements
                </div>
                <Link to="/announcements" style={{ textDecoration: 'none', fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>View all</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.announcements.map((a: any) => (
                  <Link key={a.id} to="/announcements" style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: 'var(--color-surface)', border: `1px solid ${a.isPinned ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {a.isPinned ? <IconPin size={15} color="var(--color-primary)" /> : <IconSpeakerphone size={15} color="var(--color-primary)" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)', marginBottom: 2 }}>{a.title}</div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.body}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Attendance at-a-glance bar */}
          {role === 'HR_ADMIN' && data.headcount?.active > 0 && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Today's Attendance at a Glance</div>
              <div style={{ height: 10, borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: 10 }}>
                {(() => {
                  const total = data.headcount.active;
                  const present = data.todayAttendance?.present ?? 0;
                  const leave = data.todayAttendance?.onLeave ?? 0;
                  const absent = data.todayAttendance?.absent ?? 0;
                  const unmarked = Math.max(0, total - present - leave - absent);
                  return <>
                    <div style={{ width: `${(present / total) * 100}%`, background: '#22c55e' }} />
                    <div style={{ width: `${(leave / total) * 100}%`, background: '#3b82f6' }} />
                    <div style={{ width: `${(absent / total) * 100}%`, background: '#ef4444' }} />
                    <div style={{ width: `${(unmarked / total) * 100}%`, background: 'var(--color-border)' }} />
                  </>;
                })()}
              </div>
              <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                {[
                  { color: '#22c55e', label: 'Present', value: data.todayAttendance?.present ?? 0 },
                  { color: '#3b82f6', label: 'On Leave', value: data.todayAttendance?.onLeave ?? 0 },
                  { color: '#ef4444', label: 'Absent', value: data.todayAttendance?.absent ?? 0 },
                  { color: 'var(--color-border)', label: 'Not Marked', value: Math.max(0, data.headcount.active - (data.todayAttendance?.present ?? 0) - (data.todayAttendance?.onLeave ?? 0) - (data.todayAttendance?.absent ?? 0)) },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--color-text-secondary)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, display: 'inline-block' }} />
                    {l.label}: <strong style={{ color: 'var(--color-text)' }}>{l.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
