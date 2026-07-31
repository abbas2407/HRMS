import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconPlus, IconTrash, IconDownload } from '@tabler/icons-react';

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  NATIONAL: { bg: '#dcfce7', color: '#166534' },
  COMPANY:  { bg: '#eff6ff', color: '#1d4ed8' },
  OPTIONAL: { bg: '#fef9c3', color: '#854d0e' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function HolidayCalendarPage() {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: '', name: '', type: 'COMPANY' as const });

  const { data, isLoading } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => api.get(`/leave/holidays?year=${year}`).then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/leave/holidays', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holidays'] }); setShowModal(false); setForm({ date: '', name: '', type: 'COMPANY' }); },
  });

  const seedMutation = useMutation({
    mutationFn: () => api.post(`/leave/holidays/seed-national?year=${year}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leave/holidays/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });

  const holidays: any[] = data || [];

  // Group by month
  const byMonth: Record<number, any[]> = {};
  for (const h of holidays) {
    const m = new Date(h.date).getMonth();
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(h);
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Holiday Calendar</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>Company holidays for {year}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, cursor: 'pointer' }}>
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, cursor: 'pointer' }}>
            {seedMutation.isPending ? 'Seeding...' : 'Seed National Holidays'}
          </button>
          <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            <IconPlus size={15} /> Add Holiday
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {Object.entries(TYPE_STYLE).map(([type, s]) => (
          <span key={type} style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: s.bg, color: s.color }}>{type}</span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-text-secondary)' }}>{holidays.length} holidays this year</span>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)', padding: 20 }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {MONTHS.map((month, idx) => {
            const mHolidays = byMonth[idx] || [];
            return (
              <div key={month} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{month} {year}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{mHolidays.length} holidays</span>
                </div>
                {mHolidays.length === 0 ? (
                  <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>No holidays</div>
                ) : mHolidays.map((h: any) => {
                  const s = TYPE_STYLE[h.type] || TYPE_STYLE.COMPANY;
                  const d = new Date(h.date);
                  return (
                    <div key={h.id} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ width: 36, textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{d.getDate()}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: s.bg, color: s.color }}>{h.type}</span>
                      </div>
                      <button onClick={() => deleteMutation.mutate(h.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.6, padding: 4 }}>
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

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 28, width: 380 }}>
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
                  <option value="NATIONAL">National</option>
                  <option value="COMPANY">Company</option>
                  <option value="OPTIONAL">Optional</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)', fontSize: 13 }}>Cancel</button>
                <button onClick={() => createMutation.mutate()} disabled={!form.date || !form.name || createMutation.isPending}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  {createMutation.isPending ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
