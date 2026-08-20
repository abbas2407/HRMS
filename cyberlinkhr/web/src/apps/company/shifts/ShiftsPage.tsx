import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../../../lib/api';
import {
  IconPlus, IconClock, IconUsers, IconEdit, IconTrash,
  IconTable, IconLayoutGrid, IconDownload, IconSearch, IconChevronDown,
} from '@tabler/icons-react';

const PRESET_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

const shiftSchema = z.object({
  name: z.string().min(1, 'Name required'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM format'),
  graceMinutes: z.number().int().min(0).max(60).default(10),
  isNightShift: z.boolean().default(false),
  color: z.string().default('#6366f1'),
});
type ShiftForm = z.infer<typeof shiftSchema>;

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const STATUS_SHORT: Record<string, string> = {
  PRESENT: 'P', LATE: 'L', HALF_DAY: 'H', ABSENT: 'A',
  LEAVE: 'LV', HOLIDAY: 'HO', WEEK_OFF: 'WO', OFF: 'OFF', A: 'A',
};

const STATUS_BG: Record<string, string> = {
  PRESENT: '#dcfce7', LATE: '#fef9c3', HALF_DAY: '#ffedd5', ABSENT: '#fee2e2',
  LEAVE: '#ede9fe', HOLIDAY: '#dbeafe', WEEK_OFF: '#f1f5f9', OFF: '#f1f5f9', A: '#fee2e2',
};

const STATUS_FG: Record<string, string> = {
  PRESENT: '#166534', LATE: '#854d0e', HALF_DAY: '#9a3412', ABSENT: '#991b1b',
  LEAVE: '#6d28d9', HOLIDAY: '#1d4ed8', WEEK_OFF: '#64748b', OFF: '#64748b', A: '#991b1b',
};

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function ShiftsPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [tab, setTab] = useState<'cards' | 'roster'>('cards');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  // Roster filters
  const [rosterYear, setRosterYear] = useState(now.getFullYear());
  const [rosterMonth, setRosterMonth] = useState(now.getMonth() + 1);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [showEmpDrop, setShowEmpDrop] = useState(false);
  const empDropRef = useRef<HTMLDivElement>(null);

  const { data: shiftsData, isLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => api.get('/shifts').then(r => r.data.data),
  });

  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ['shifts-roster', rosterYear, rosterMonth, selectedShiftId, selectedEmpId],
    queryFn: () => {
      const p = new URLSearchParams({ year: String(rosterYear), month: String(rosterMonth) });
      if (selectedShiftId) p.set('shiftId', selectedShiftId);
      if (selectedEmpId) p.set('employeeId', selectedEmpId);
      return api.get(`/shifts/roster?${p}`).then(r => r.data.data);
    },
    enabled: tab === 'roster',
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { graceMinutes: 10, isNightShift: false, color: '#6366f1' },
  });
  const watchColor = watch('color');

  const saveMutation = useMutation({
    mutationFn: (body: ShiftForm) =>
      editing ? api.put(`/shifts/${editing.id}`, body) : api.post('/shifts', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/shifts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });

  function openCreate() {
    setEditing(null);
    reset({ graceMinutes: 10, isNightShift: false, color: '#6366f1' });
    setShowModal(true);
  }

  function openEdit(shift: any) {
    setEditing(shift);
    reset({
      name: shift.name, startTime: shift.startTime, endTime: shift.endTime,
      graceMinutes: shift.graceMinutes ?? 10, isNightShift: shift.isNightShift ?? false,
      color: shift.color ?? '#6366f1',
    });
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditing(null); reset(); }
  const onSubmit = (data: ShiftForm) => saveMutation.mutate(data);

  // CSV export
  function downloadRoster() {
    if (!rosterData) return;
    const { rows, days, meta } = rosterData;
    const header = ['Employee Code', 'Employee Name', 'Department', 'Shift', 'Working Days', 'Present Days',
      ...days.map((d: any) => `${d.date} (${d.label})`)].join(',');
    const csvRows = rows.map((row: any) => [
      row.employeeCode, `${row.firstName} ${row.lastName}`, row.departmentName ?? '',
      row.shiftName ?? '', row.workingDays, row.presentDays,
      ...row.days.map((d: any) => STATUS_SHORT[d.status] ?? d.status),
    ].map(v => `"${v}"`).join(','));
    const csv = [header, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shift-roster-${meta.year}-${String(meta.month).padStart(2,'0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const allEmps: any[] = (rosterData?.rows ?? []).map((r: any) => ({
    id: r.employeeId, code: r.employeeCode,
    name: `${r.firstName} ${r.lastName}`,
  }));
  const filteredEmps = empSearch
    ? allEmps.filter(e => e.name.toLowerCase().includes(empSearch.toLowerCase()) || e.code.includes(empSearch))
    : allEmps;
  const selectedEmp = allEmps.find(e => e.id === selectedEmpId);

  const shiftList: any[] = shiftsData || [];

  if (isLoading) return <div style={{ padding: 24 }}>Loading shifts...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Shifts</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Manage work shifts and timings
          </p>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          <IconPlus size={16} /> Add Shift
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'cards', label: 'Shift Cards', icon: <IconLayoutGrid size={14} /> },
          { key: 'roster', label: 'Shift Roster', icon: <IconTable size={14} /> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: tab === t.key ? 'var(--color-primary)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--color-text-secondary)',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── CARDS TAB ── */}
      {tab === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {shiftList.map((shift: any) => (
            <div key={shift.id} style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 12, padding: 20, borderTop: `4px solid ${shift.color ?? '#6366f1'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: shift.color ?? '#6366f1', flexShrink: 0 }} />
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{shift.name}</div>
                  </div>
                  {shift.isNightShift && (
                    <span style={{ fontSize: 11, background: '#1e3a5f', color: '#93c5fd', padding: '2px 8px', borderRadius: 12, display: 'inline-block' }}>Night Shift</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(shift)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconEdit size={16} /></button>
                  <button onClick={() => deleteMutation.mutate(shift.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><IconTrash size={16} /></button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 8px', color: 'var(--color-text-secondary)', fontSize: 14 }}>
                <IconClock size={14} /> {shift.startTime} – {shift.endTime}
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>({shift.graceMinutes ?? 10}m grace)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)', fontSize: 13 }}>
                <IconUsers size={13} /> {shift.assignedCount ?? 0} employees
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ROSTER TAB ── */}
      {tab === 'roster' && (
        <div>
          {/* Filters bar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            {/* Year */}
            <select value={rosterYear} onChange={e => setRosterYear(Number(e.target.value))}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            {/* Months */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {MONTHS.map((m, i) => (
                <button key={m} onClick={() => setRosterMonth(i + 1)}
                  style={{ padding: '5px 10px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    borderColor: rosterMonth === i + 1 ? 'var(--color-primary)' : 'var(--color-border)',
                    background: rosterMonth === i + 1 ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: rosterMonth === i + 1 ? '#fff' : 'var(--color-text)',
                  }}>
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>

            <div style={{ width: 1, height: 28, background: 'var(--color-border)' }} />

            {/* Attendance Cycle / Shift filter */}
            <select value={selectedShiftId} onChange={e => setSelectedShiftId(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              <option value="">All Shifts (Attendance Cycle)</option>
              {shiftList.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Employee dropdown */}
            <div ref={empDropRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowEmpDrop(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: 600, fontSize: 13, cursor: 'pointer', minWidth: 160 }}>
                <IconUsers size={14} />
                {selectedEmp ? `${selectedEmp.name}` : 'All Employees'}
                <IconChevronDown size={13} style={{ marginLeft: 'auto' }} />
              </button>
              {showEmpDrop && (
                <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 100, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, minWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
                  <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-background)', borderRadius: 6, padding: '4px 10px' }}>
                      <IconSearch size={13} style={{ color: 'var(--color-text-secondary)' }} />
                      <input value={empSearch} onChange={e => setEmpSearch(e.target.value)} placeholder="Search employee..."
                        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--color-text)', width: '100%' }} />
                    </div>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <button onClick={() => { setSelectedEmpId(''); setShowEmpDrop(false); setEmpSearch(''); }}
                      style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: !selectedEmpId ? 'var(--color-primary)' : 'transparent', color: !selectedEmpId ? '#fff' : 'var(--color-text)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      All Employees
                    </button>
                    {filteredEmps.map(e => (
                      <button key={e.id} onClick={() => { setSelectedEmpId(e.id); setShowEmpDrop(false); setEmpSearch(''); }}
                        style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: selectedEmpId === e.id ? 'var(--color-primary)' : 'transparent', color: selectedEmpId === e.id ? '#fff' : 'var(--color-text)', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                        <div style={{ fontWeight: 600 }}>{e.name}</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{e.code}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={downloadRoster} disabled={!rosterData}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto', opacity: rosterData ? 1 : 0.5 }}>
              <IconDownload size={14} /> Download Report
            </button>
          </div>

          {/* Shift color legend */}
          {shiftList.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              {shiftList.map((s: any) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color ?? '#6366f1', flexShrink: 0 }} />
                  {s.name} ({s.startTime}–{s.endTime})
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                {[['P','#dcfce7','#166534'],['L','#fef9c3','#854d0e'],['A','#fee2e2','#991b1b'],['WO','#f1f5f9','#64748b'],['LV','#ede9fe','#6d28d9']].map(([label, bg, fg]) => (
                  <span key={label} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: bg, color: fg, fontWeight: 700 }}>{label}</span>
                ))}
              </div>
            </div>
          )}

          {/* Grid */}
          {rosterLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading roster...</div>
          ) : !rosterData || rosterData.rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)', background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
              No employees assigned to any shift for this period.
            </div>
          ) : (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: rosterData.days.length * 36 + 300 }}>
                <thead>
                  <tr style={{ background: 'var(--color-background)', borderBottom: '2px solid var(--color-border)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 12, minWidth: 180, position: 'sticky', left: 0, background: 'var(--color-background)', zIndex: 2 }}>Employee</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: 12, minWidth: 90 }}>Shift</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: 12, minWidth: 40 }}>WD</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: 12, minWidth: 40 }}>P</th>
                    {(rosterData.days as any[]).map((d: any) => (
                      <th key={d.date} style={{
                        padding: '6px 2px', textAlign: 'center', fontWeight: 700, minWidth: 32,
                        color: d.dayOfWeek === 0 || d.dayOfWeek === 6 ? '#ef4444' : 'var(--color-text)',
                      }}>
                        <div>{new Date(d.date + 'T00:00:00').getDate()}</div>
                        <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>{d.label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(rosterData.rows as any[]).map((row: any, ri: number) => (
                    <tr key={row.employeeId} style={{ borderBottom: '1px solid var(--color-border)', background: ri % 2 === 0 ? 'var(--color-surface)' : 'var(--color-background)' }}>
                      <td style={{ padding: '8px 14px', position: 'sticky', left: 0, background: ri % 2 === 0 ? 'var(--color-surface)' : 'var(--color-background)', zIndex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{row.firstName} {row.lastName}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{row.employeeCode} · {row.departmentName ?? '—'}</div>
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                        {row.shiftName ? (
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: hexToRgba(row.shiftColor ?? '#6366f1', 0.15), color: row.shiftColor ?? '#6366f1', fontWeight: 700, fontSize: 11, border: `1px solid ${hexToRgba(row.shiftColor ?? '#6366f1', 0.3)}` }}>
                            {row.shiftName}
                          </span>
                        ) : <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 600, fontSize: 12 }}>{row.workingDays}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 600, fontSize: 12 }}>{row.presentDays}</td>
                      {(row.days as any[]).map((day: any) => {
                        const st = day.status;
                        const bg = day.isWeekOff ? STATUS_BG['WEEK_OFF'] : (STATUS_BG[st] ?? '#f8fafc');
                        const fg = day.isWeekOff ? STATUS_FG['WEEK_OFF'] : (STATUS_FG[st] ?? '#64748b');
                        const label = day.isWeekOff ? 'WO' : (STATUS_SHORT[st] ?? st);
                        // Color from shift if present
                        const shiftBg = (!day.isWeekOff && row.shiftColor && (st === 'PRESENT' || st === 'LATE'))
                          ? hexToRgba(row.shiftColor, 0.18) : bg;
                        const shiftFg = (!day.isWeekOff && row.shiftColor && (st === 'PRESENT' || st === 'LATE'))
                          ? row.shiftColor : fg;
                        return (
                          <td key={day.date} style={{ padding: '4px 2px', textAlign: 'center' }}
                            title={`${day.date}: ${st}${day.punchIn ? ` | IN: ${new Date(day.punchIn).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` : ''}${day.punchOut ? ` OUT: ${new Date(day.punchOut).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` : ''}`}>
                            <span style={{ display: 'inline-block', minWidth: 24, padding: '2px 3px', borderRadius: 4, background: shiftBg, color: shiftFg, fontWeight: 700, fontSize: 10 }}>
                              {label}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 28, width: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{editing ? 'Edit Shift' : 'Create Shift'}</h3>
            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Shift Name</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input {...register('name')} placeholder="e.g. Morning Shift"
                    style={{ width: '100%', padding: '8px 40px 8px 12px', borderRadius: 8, border: `2px solid ${watchColor}`, background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box', fontWeight: 600 }} />
                  {/* Color dot preview */}
                  <span style={{ position: 'absolute', right: 10, width: 16, height: 16, borderRadius: '50%', background: watchColor, border: '2px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                </div>
                {errors.name && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.name.message}</span>}
              </div>

              {/* Color picker */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Shift Colour</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setValue('color', c)}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: watchColor === c ? '3px solid var(--color-text)' : '3px solid transparent', cursor: 'pointer', outline: 'none', transition: 'border 0.15s' }} />
                  ))}
                  <input type="color" value={watchColor} onChange={e => setValue('color', e.target.value)}
                    style={{ width: 28, height: 28, padding: 2, borderRadius: '50%', border: '1px solid var(--color-border)', cursor: 'pointer', background: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Start Time</label>
                  <input {...register('startTime')} type="time" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                  {errors.startTime && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.startTime.message}</span>}
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>End Time</label>
                  <input {...register('endTime')} type="time" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
                  {errors.endTime && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.endTime.message}</span>}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Grace Period (minutes)</label>
                <input {...register('graceMinutes', { valueAsNumber: true })} type="number" min={0} max={60}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box' }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input {...register('isNightShift')} type="checkbox" /> Night Shift (crosses midnight)
              </label>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={closeModal} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} style={{ padding: '8px 16px', borderRadius: 8, background: watchColor, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {saveMutation.isPending ? 'Saving...' : 'Save Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
