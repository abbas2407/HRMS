import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconPlus, IconTrash, IconRefresh, IconCalendar } from '@tabler/icons-react';

const TYPE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  NATIONAL: { bg: '#dcfce7', color: '#166534', label: 'National' },
  COMPANY:  { bg: '#eff6ff', color: '#1d4ed8', label: 'Company'  },
  OPTIONAL: { bg: '#fef9c3', color: '#854d0e', label: 'Optional' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function HolidayCalendarPage() {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: '', name: '', type: 'NATIONAL' as 'NATIONAL'|'COMPANY'|'OPTIONAL' });
  const [typeFilter, setTypeFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => api.get(`/leave/holidays?year=${year}`).then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/leave/holidays', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      qc.invalidateQueries({ queryKey: ['muster'] }); // sync muster
      setShowModal(false);
      setForm({ date: '', name: '', type: 'NATIONAL' });
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => api.post(`/leave/holidays/seed-national?year=${year}`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      qc.invalidateQueries({ queryKey: ['muster'] });
      alert(`Seeded ${res.data?.seeded ?? 0} holidays for ${year}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leave/holidays/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      qc.invalidateQueries({ queryKey: ['muster'] });
    },
  });

  const allHolidays: any[] = data || [];
  const filtered = typeFilter ? allHolidays.filter((h: any) => h.type === typeFilter) : allHolidays;

  // Group by month
  const byMonth: Record<number, any[]> = {};
  for (const h of filtered) {
    const m = new Date(h.date + 'T00:00:00').getMonth();
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(h);
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Holiday Calendar</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            National, company & optional holidays for {year} · {allHolidays.length} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            <IconRefresh size={14} style={{ animation: seedMutation.isPending ? 'spin 1s linear infinite' : 'none' }} />
            {seedMutation.isPending ? 'Seeding...' : 'Seed Indian Holidays'}
          </button>
          <button onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            <IconPlus size={15} /> Add Holiday
          </button>
        </div>
      </div>

      {/* Type filter + legend */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setTypeFilter('')}
          style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600, borderColor: !typeFilter ? 'var(--color-primary)' : 'var(--color-border)', background: !typeFilter ? 'var(--color-primary)' : 'var(--color-surface)', color: !typeFilter ? '#fff' : 'var(--color-text)' }}>
          All ({allHolidays.length})
        </button>
        {Object.entries(TYPE_STYLE).map(([type, s]) => {
          const count = allHolidays.filter((h: any) => h.type === type).length;
          return (
            <button key={type} onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
              style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid`, cursor: 'pointer', fontSize: 12, fontWeight: 600, borderColor: typeFilter === type ? s.color : 'var(--color-border)', background: typeFilter === type ? s.bg : 'var(--color-surface)', color: typeFilter === type ? s.color : 'var(--color-text)' }}>
              {s.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Seed help text */}
      {allHolidays.length === 0 && !isLoading && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', fontSize: 13, color: '#1d4ed8' }}>
          💡 Click <strong>Seed Indian Holidays</strong> to pre-load all Indian national holidays including Republic Day, Independence Day, Gandhi Jayanti, Diwali, Eid, Christmas, Holi and more for {year}.
        </div>
      )}

      {/* Monthly grid */}
      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)', padding: 20 }}>Loading holidays...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {MONTHS.map((month, idx) => {
            const mHolidays = byMonth[idx] || [];
            return (
              <div key={month} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-background)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconCalendar size={14} style={{ color: 'var(--color-text-secondary)' }} />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{month} {year}</span>
                  </div>
                  <span style={{ fontSize: 12, color: mHolidays.length > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                    {mHolidays.length} holiday{mHolidays.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {mHolidays.length === 0 ? (
                  <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No holidays this month</div>
                ) : mHolidays.map((h: any) => {
                  const s = TYPE_STYLE[h.type] || TYPE_STYLE.COMPANY;
                  const d = new Date(h.date + 'T00:00:00');
                  return (
                    <div key={h.id} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ width: 40, textAlign: 'center', flexShrink: 0, background: s.bg, borderRadius: 8, padding: '4px 0' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color: s.color }}>{d.getDate()}</div>
                        <div style={{ fontSize: 9, color: s.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{WEEKDAYS[d.getDay()]}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
                      </div>
                      <button onClick={() => { if (confirm(`Remove "${h.name}"?`)) deleteMutation.mutate(h.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.5, padding: 4, flexShrink: 0 }}
                        title="Remove holiday">
                        <IconTrash size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Holiday Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 28, width: 400 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Add Holiday</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Holiday Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Diwali"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }}>
                  <option value="NATIONAL">National (Indian / Gazetted)</option>
                  <option value="COMPANY">Company Holiday</option>
                  <option value="OPTIONAL">Optional / Restricted</option>
                </select>
              </div>
              <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 8, fontSize: 12, color: '#1d4ed8' }}>
                ℹ This holiday will automatically sync with the Attendance Muster and mark the date as <strong>H</strong>.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)', fontSize: 13 }}>Cancel</button>
                <button onClick={() => createMutation.mutate()} disabled={!form.date || !form.name || createMutation.isPending}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: !form.date || !form.name ? 0.5 : 1 }}>
                  {createMutation.isPending ? 'Adding...' : 'Add Holiday'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
