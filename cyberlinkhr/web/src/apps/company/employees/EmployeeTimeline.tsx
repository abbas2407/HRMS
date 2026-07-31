import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import { IconBriefcase, IconMoneybag, IconFile, IconCalendar } from '@tabler/icons-react';

type FilterType = 'ALL' | 'EMPLOYMENT' | 'SALARY' | 'DOCUMENT';

const FILTERS: FilterType[] = ['ALL', 'EMPLOYMENT', 'SALARY', 'DOCUMENT'];

const TYPE_ICON: Record<string, React.ReactNode> = {
  EMPLOYMENT: <IconBriefcase size={14} />,
  SALARY: <IconMoneybag size={14} />,
  DOCUMENT: <IconFile size={14} />,
};

const TYPE_COLOR: Record<string, 'blue' | 'success' | 'gray' | 'warning'> = {
  EMPLOYMENT: 'blue',
  SALARY: 'success',
  DOCUMENT: 'gray',
};

interface Props { empId: string; }

export default function EmployeeTimeline({ empId }: Props) {
  const [filter, setFilter] = useState<FilterType>('ALL');

  const { data: events, isLoading } = useQuery({
    queryKey: ['employee-timeline', empId],
    queryFn: () => api.get(`/employees/${empId}/timeline`).then(r => r.data.data),
  });

  const filtered = (events || []).filter(
    (e: any) => filter === 'ALL' || e.type === filter
  );

  // Group by month
  const grouped: Record<string, any[]> = {};
  for (const ev of filtered) {
    const key = new Date(ev.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  }

  return (
    <div>
      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            background: filter === f ? 'var(--brand)' : 'var(--bg-subtle)',
            color: filter === f ? 'white' : 'var(--text-2)',
            border: `1px solid ${filter === f ? 'var(--brand)' : 'var(--border)'}`,
          }}>
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
        {!isLoading && (
          <span style={{ alignSelf: 'center', fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={60} />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
          No events found
        </div>
      ) : (
        Object.entries(grouped).map(([month, items]) => (
          <div key={month} style={{ marginBottom: 24 }}>
            {/* Month header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <IconCalendar size={13} color="var(--text-3)" />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{month}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Events */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {items.map((ev, idx) => (
                <div key={ev.id} style={{ display: 'flex', gap: 12 }}>
                  {/* Timeline spine */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: ev.type === 'SALARY' ? 'rgba(34,197,94,0.1)' : ev.type === 'DOCUMENT' ? 'var(--bg-subtle)' : 'rgba(37,99,235,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: ev.type === 'SALARY' ? 'var(--success)' : ev.type === 'DOCUMENT' ? 'var(--text-3)' : 'var(--brand)',
                      flexShrink: 0,
                    }}>
                      {TYPE_ICON[ev.type]}
                    </div>
                    {idx < items.length - 1 && (
                      <div style={{ width: 1, flex: 1, minHeight: 16, background: 'var(--border)', margin: '4px 0' }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: idx < items.length - 1 ? 16 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 2 }}>
                      <Badge variant={TYPE_COLOR[ev.type]} dot={false}>
                        <span style={{ fontSize: 10 }}>{ev.subType?.replace(/_/g, ' ')}</span>
                      </Badge>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                        {new Date(ev.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        {' '}
                        {new Date(ev.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{ev.title}</div>
                    {ev.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{ev.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
