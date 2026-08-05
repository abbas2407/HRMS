import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { IconBell, IconCheck, IconTicket, IconMessage, IconCoin, IconShield, IconCalendar, IconCreditCard } from '@tabler/icons-react';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  TICKET: <IconTicket size={20} color="var(--color-primary)" />,
  TICKET_REPLY: <IconMessage size={20} color="var(--color-success)" />,
  EXPENSE: <IconCoin size={20} color="var(--color-warning)" />,
  GRIEVANCE: <IconShield size={20} color="var(--color-danger)" />,
  LEAVE: <IconCalendar size={20} color="var(--color-primary)" />,
  PAYROLL: <IconCreditCard size={20} color="var(--color-success)" />,
  DEFAULT: <IconBell size={20} color="var(--color-text-secondary)" />,
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: notifs, isLoading } = useQuery<any[]>({
    queryKey: ['notifications-full'],
    queryFn: () => api.get('/notifications').then(r => r.data.data),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-full'] });
      qc.invalidateQueries({ queryKey: ['notif-unread'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-full'] });
      qc.invalidateQueries({ queryKey: ['notif-unread'] });
    },
  });

  const handleClick = (n: any) => {
    if (!n.readAt) markReadMutation.mutate(n.id);
    if (n.linkPath) navigate(n.linkPath);
  };

  const unreadCount = (notifs || []).filter(n => !n.readAt).length;

  return (
    <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconBell size={22} color="var(--color-primary)" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Notifications</h1>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <IconCheck size={13} /> Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : !(notifs || []).length ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
          <IconBell size={40} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
          No notifications yet.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-surface)' }}>
          {(notifs || []).map((n: any, idx: number) => (
            <div key={n.id}
              onClick={() => handleClick(n)}
              style={{
                padding: '14px 18px',
                background: n.readAt ? 'transparent' : 'rgba(99,102,241,0.04)',
                borderBottom: idx < (notifs || []).length - 1 ? '1px solid var(--color-border)' : 'none',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                cursor: n.linkPath ? 'pointer' : 'default',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-subtle)', flexShrink: 0, marginTop: 2 }}>
                {TYPE_ICONS[n.type] || TYPE_ICONS.DEFAULT}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: n.readAt ? 500 : 700 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                    {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 3 }}>{n.message}</div>
              </div>
              {!n.readAt && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
