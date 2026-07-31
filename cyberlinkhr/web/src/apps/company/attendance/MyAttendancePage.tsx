import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PRESENT:  { bg: '#dcfce7', color: '#166534', label: 'P' },
  LATE:     { bg: '#fef9c3', color: '#854d0e', label: 'L' },
  HALF_DAY: { bg: '#ffedd5', color: '#9a3412', label: 'H' },
  ABSENT:   { bg: '#fee2e2', color: '#991b1b', label: 'A' },
};

function formatTime(d: string | Date | null): string {
  if (!d) return '--';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatHours(h: string | null): string {
  if (!h) return '--';
  const v = parseFloat(h);
  return `${Math.floor(v)}h ${Math.round((v % 1) * 60)}m`;
}

export default function MyAttendancePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'my', month, year],
    queryFn: () => api.get(`/attendance/my?month=${month}&year=${year}`).then(r => r.data),
  });

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const logs: any[] = data?.data || [];
  const logMap = new Map(logs.map((l: any) => [l.date, l]));

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();

  // Stats
  const present = logs.filter(l => l.status === 'PRESENT').length;
  const late = logs.filter(l => l.status === 'LATE').length;
  const halfDay = logs.filter(l => l.status === 'HALF_DAY').length;
  const absent = logs.filter(l => l.status === 'ABSENT').length;
  const totalHours = logs.reduce((s, l) => s + (l.workingHours ? parseFloat(l.workingHours) : 0), 0);

  const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>My Attendance</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--color-text)' }}><IconChevronLeft size={16} /></button>
          <span style={{ fontWeight: 600, minWidth: 140, textAlign: 'center' }}>{monthName}</span>
          <button onClick={nextMonth} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--color-text)' }}><IconChevronRight size={16} /></button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Present', value: present, color: '#22c55e' },
          { label: 'Late', value: late, color: '#f59e0b' },
          { label: 'Half Day', value: halfDay, color: '#f97316' },
          { label: 'Absent', value: absent, color: '#ef4444' },
          { label: 'Total Hours', value: `${Math.floor(totalHours)}h`, color: 'var(--color-primary)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', padding: '4px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const log = logMap.get(dateStr);
            const s = log?.status ? STATUS_STYLE[log.status] : null;
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            return (
              <div key={day} title={log ? `In: ${formatTime(log.punchIn)} | Out: ${formatTime(log.punchOut)} | ${formatHours(log.workingHours)}` : ''} style={{
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                background: s?.bg || 'transparent',
                border: isToday ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: log ? 'pointer' : 'default',
              }}>
                <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: s?.color || 'var(--color-text)' }}>{day}</span>
                {s && <span style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{s.label}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_STYLE).map(([key, v]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, background: v.bg, border: `1px solid ${v.color}` }} />
            {key.replace('_', ' ')}
          </div>
        ))}
      </div>
    </div>
  );
}

