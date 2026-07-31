import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  IconBell, IconSearch, IconCheck,
  IconTicket, IconMessage, IconReceipt, IconShield,
  IconCalendar, IconCash, IconUsers, IconFileText, IconX,
} from '@tabler/icons-react';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import Avatar from '../ui/Avatar';
import { io } from 'socket.io-client';

function NotifIcon({ type }: { type: string }) {
  const props = { size: 16, style: { flexShrink: 0, marginTop: 1 } };
  if (type === 'TICKET') return <IconTicket {...props} />;
  if (type === 'TICKET_REPLY') return <IconMessage {...props} />;
  if (type === 'EXPENSE') return <IconReceipt {...props} />;
  if (type === 'GRIEVANCE') return <IconShield {...props} />;
  if (type === 'LEAVE') return <IconCalendar {...props} />;
  if (type === 'PAYROLL') return <IconCash {...props} />;
  return <IconBell {...props} />;
}

type SearchResult = { id: string; label: string; sub: string; href: string };
type SearchData = { employees: SearchResult[]; payslips: SearchResult[]; leaveRequests: SearchResult[] };

function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isFetching } = useQuery<SearchData>({
    queryKey: ['search', q],
    queryFn: () => api.get(`/search?q=${encodeURIComponent(q)}`).then(r => r.data.data),
    enabled: q.trim().length > 0,
    placeholderData: prev => prev,
  });

  const allResults: (SearchResult & { group: string })[] = [
    ...(data?.employees || []).map(r => ({ ...r, group: 'Employees' })),
    ...(data?.payslips || []).map(r => ({ ...r, group: 'Payslips' })),
    ...(data?.leaveRequests || []).map(r => ({ ...r, group: 'Leave Requests' })),
  ];

  useEffect(() => { setCursor(0); }, [q]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const go = useCallback((href: string) => {
    navigate(href);
    onClose();
  }, [navigate, onClose]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, allResults.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && allResults[cursor]) { go(allResults[cursor].href); }
    else if (e.key === 'Escape') { onClose(); }
  };

  const groups = ['Employees', 'Payslips', 'Leave Requests'];
  const groupIcon = (g: string) => {
    if (g === 'Employees') return <IconUsers size={13} />;
    if (g === 'Payslips') return <IconFileText size={13} />;
    return <IconCalendar size={13} />;
  };

  let flatIdx = 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 120,
    }} onClick={onClose}>
      <div style={{
        width: 560, background: 'var(--bg-surface)', borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
        border: '1px solid var(--border)',
      }} onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <IconSearch size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search employees, payslips, leave requests..."
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, color: 'var(--text-1)',
            }}
          />
          {isFetching && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Searching...</span>}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 0 }}>
            <IconX size={16} />
          </button>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {q.trim() === '' && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              Type to search across employees, payslips, and leave requests
            </div>
          )}
          {q.trim().length > 0 && allResults.length === 0 && !isFetching && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              No results for "{q}"
            </div>
          )}
          {groups.map(group => {
            const items = allResults.filter(r => r.group === group);
            if (!items.length) return null;
            return (
              <div key={group}>
                <div style={{
                  padding: '8px 16px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {groupIcon(group)} {group}
                </div>
                {items.map(item => {
                  const idx = flatIdx++;
                  const active = idx === cursor;
                  return (
                    <div
                      key={item.id}
                      onClick={() => go(item.href)}
                      onMouseEnter={() => setCursor(idx)}
                      style={{
                        padding: '9px 16px', cursor: 'pointer',
                        background: active ? 'var(--bg-subtle)' : 'transparent',
                        display: 'flex', flexDirection: 'column', gap: 2,
                        borderLeft: active ? '2px solid var(--brand)' : '2px solid transparent',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{item.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.sub}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-3)' }}>
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}

export default function Topbar() {
  const { user, tenant } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const { data: unread } = useQuery<number>({
    queryKey: ['notif-unread'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data.data.count),
    refetchInterval: 30_000,
    enabled: !!user,
  });

  const { data: notifs } = useQuery<any[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data.data),
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notif-unread'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notif-unread'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  // Ctrl+K to open command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Real-time socket notifications
  useEffect(() => {
    if (!tenant?.schemaName) return;
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000', { path: '/socket.io', transports: ['websocket'] });
    socket.emit('join-tenant', tenant.schemaName);
    socket.on('notification', () => {
      qc.invalidateQueries({ queryKey: ['notif-unread'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });
    return () => { socket.disconnect(); };
  }, [tenant?.schemaName]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotifClick = (n: any) => {
    if (!n.readAt) markReadMutation.mutate(n.id);
    if (n.linkPath) { navigate(n.linkPath); setOpen(false); }
  };

  return (
    <>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}

      <header className="topbar">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            onClick={() => setPaletteOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-subtle)', border: '1px solid var(--border)',
              borderRadius: 'var(--input-radius)', padding: '5px 10px',
              width: 240, cursor: 'pointer', color: 'var(--text-3)', fontSize: 12.5,
            }}>
            <IconSearch size={14} />
            <span style={{ flex: 1 }}>Search...</span>
            <span style={{ fontSize: 10, background: 'var(--border)', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>Ctrl+K</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {tenant && (
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{tenant.name}</span>
          )}

          {/* Notification bell */}
          <div ref={dropRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', color: 'var(--text-2)', display: 'flex', alignItems: 'center', padding: 4 }}>
              <IconBell size={18} />
              {(unread ?? 0) > 0 && (
                <span style={{
                  position: 'absolute', top: 0, right: 0, width: 16, height: 16,
                  background: '#ef4444', color: '#fff', borderRadius: '50%',
                  fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}>
                  {(unread ?? 0) > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {open && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 340,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', zIndex: 999, overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(unread ?? 0) > 0 && (
                      <button onClick={() => markAllMutation.mutate()}
                        style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                        <IconCheck size={11} /> Mark all read
                      </button>
                    )}
                    <button onClick={() => { navigate('/notifications'); setOpen(false); }}
                      style={{ fontSize: 11, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      See all
                    </button>
                  </div>
                </div>
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {!(notifs || []).length ? (
                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}>No notifications yet</div>
                  ) : (notifs || []).slice(0, 10).map((n: any) => (
                    <div key={n.id} onClick={() => handleNotifClick(n)}
                      style={{
                        padding: '10px 16px', cursor: n.linkPath ? 'pointer' : 'default',
                        background: n.readAt ? 'transparent' : 'rgba(99,102,241,0.05)',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                      }}>
                      <NotifIcon type={n.type} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: n.readAt ? 500 : 700 }}>{n.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{n.message}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                          {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {!n.readAt && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 4 }} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Avatar name={user?.email || 'User'} size={28} />
        </div>
      </header>
    </>
  );
}
