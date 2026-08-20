import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { IconDownload, IconSearch, IconChevronDown, IconUsers } from '@tabler/icons-react';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function timeStr(d: string | Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Cell rendering — only IN/OUT gets colour, everything else plain text
function MusterCell({ day }: { day: any }) {
  const { status, punchIn, punchOut, isLate, holidayName } = day;

  if (status === 'PRESENT' || status === 'LATE') {
    const inT  = timeStr(punchIn);
    const outT = timeStr(punchOut);
    const bg   = isLate ? '#fef9c3' : '#dcfce7';
    const fg   = isLate ? '#854d0e' : '#166534';
    return (
      <td style={{ padding: '3px 4px', textAlign: 'center', minWidth: 64 }}>
        <div style={{ background: bg, color: fg, borderRadius: 6, padding: '3px 4px', fontSize: 10, fontWeight: 700, lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' }}>
          {inT && <div>{inT}</div>}
          {outT && <div style={{ opacity: 0.85 }}>{outT}</div>}
          {!inT && !outT && <div style={{ fontSize: 9 }}>{isLate ? 'L' : 'P'}</div>}
        </div>
      </td>
    );
  }

  if (status === 'HALF_DAY') {
    const inT  = timeStr(punchIn);
    const outT = timeStr(punchOut);
    return (
      <td style={{ padding: '3px 4px', textAlign: 'center', minWidth: 64 }}>
        <div style={{ background: '#ffedd5', color: '#9a3412', borderRadius: 6, padding: '3px 4px', fontSize: 10, fontWeight: 700, lineHeight: 1.4 }}>
          {inT && <div>{inT}</div>}
          {outT && <div style={{ opacity: 0.85 }}>{outT}</div>}
          {!inT && !outT && <div>½</div>}
        </div>
      </td>
    );
  }

  // A, H, WO, LV, LEAVE — plain text, NO color
  const labelMap: Record<string, string> = {
    A: 'A', ABSENT: 'A', H: 'H', WO: 'WO',
    LEAVE: 'LV', HOLIDAY: 'H', WEEK_OFF: 'WO',
  };
  const label = labelMap[status] ?? status;
  return (
    <td style={{ padding: '3px 4px', textAlign: 'center', minWidth: 64 }}>
      <span
        title={status === 'H' && holidayName ? holidayName : undefined}
        style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
    </td>
  );
}

export default function AttendanceMusterPage() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [selectedEmpId,   setSelectedEmpId]   = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [showEmpDrop, setShowEmpDrop] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: musterData, isLoading } = useQuery({
    queryKey: ['muster', year, month, selectedShiftId, selectedEmpId],
    queryFn: () => {
      const p = new URLSearchParams({ year: String(year), month: String(month) });
      if (selectedShiftId) p.set('shiftId', selectedShiftId);
      if (selectedEmpId)   p.set('employeeId', selectedEmpId);
      return api.get(`/attendance/muster?${p}`).then(r => r.data.data);
    },
  });

  const { data: shiftsData } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => api.get('/shifts').then(r => r.data.data),
  });

  const rows:   any[]  = musterData?.rows  ?? [];
  const days:   any[]  = musterData?.days  ?? [];
  const shiftList: any[] = shiftsData ?? [];

  // Employee search dropdown
  const allEmps = rows.map((r: any) => ({
    id: r.employeeId, code: r.employeeCode, name: `${r.firstName} ${r.lastName}`,
  }));
  const filteredEmps = empSearch
    ? allEmps.filter(e => e.name.toLowerCase().includes(empSearch.toLowerCase()) || e.code.includes(empSearch))
    : allEmps;
  const selectedEmp = allEmps.find(e => e.id === selectedEmpId);

  // ── CSV export (no colours) ───────────────────────────────────────────────
  function downloadCSV() {
    if (!rows.length) return;
    const dayHeaders = days.map((d: any) => `${d.day}(${d.dowLabel})`);
    const header = ['Code', 'Name', 'Department', 'Shift', ...dayHeaders, 'P', 'L', 'H', 'A'].join(',');
    const csvRows = rows.map((row: any) => {
      const dayVals = row.days.map((day: any) => {
        if (day.status === 'PRESENT' || day.status === 'LATE') {
          const inT  = timeStr(day.punchIn);
          const outT = timeStr(day.punchOut);
          return `"${inT}/${outT}"`;
        }
        const lm: Record<string, string> = { A:'A', ABSENT:'A', H:'H', WO:'WO', LEAVE:'LV', HOLIDAY:'H', WEEK_OFF:'WO', HALF_DAY:'½' };
        return `"${lm[day.status] ?? day.status}"`;
      });
      return [`"${row.employeeCode}"`, `"${row.firstName} ${row.lastName}"`, `"${row.departmentName ?? ''}"`, `"${row.shiftName ?? ''}"`, ...dayVals, row.totalP, row.totalL, row.totalH, row.totalA].join(',');
    });
    const csv = [header, ...csvRows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `attendance-muster-${year}-${String(month).padStart(2,'0')}.csv`;
    a.click();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, maxWidth: '100%', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Attendance Muster</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
          Monthly attendance summary — Present cells show IN / OUT timing
        </p>
      </div>

      {/* ── Filters bar ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14, flexShrink: 0 }}>

        {/* Month + Year */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Select Month</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Attendance Cycle (shift) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Select Attendance Cycle</label>
          <select value={selectedShiftId} onChange={e => setSelectedShiftId(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', minWidth: 200 }}>
            <option value="">Default Attendance Cycle</option>
            {shiftList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Employee dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Employee</label>
          <div ref={dropRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowEmpDrop(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', minWidth: 180 }}>
              <IconUsers size={13} />
              {selectedEmp ? selectedEmp.name : 'Employee: All'}
              <IconChevronDown size={12} style={{ marginLeft: 'auto' }} />
            </button>
            {showEmpDrop && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 200, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, minWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-background)', borderRadius: 6, padding: '4px 10px' }}>
                    <IconSearch size={12} style={{ color: 'var(--color-text-secondary)' }} />
                    <input value={empSearch} onChange={e => setEmpSearch(e.target.value)} placeholder="Search..."
                      style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--color-text)', width: '100%' }} autoFocus />
                  </div>
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  <button onClick={() => { setSelectedEmpId(''); setShowEmpDrop(false); setEmpSearch(''); }}
                    style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: !selectedEmpId ? 'var(--color-primary)' : 'transparent', color: !selectedEmpId ? '#fff' : 'var(--color-text)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    All Employees
                  </button>
                  {filteredEmps.map((e: any) => (
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
        </div>

        {/* Export */}
        <button onClick={downloadCSV} disabled={!rows.length}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto', opacity: rows.length ? 1 : 0.5 }}>
          <IconDownload size={14} /> Export Excel
        </button>
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
        {isLoading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading muster...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No attendance data for this period</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              {/* Row 1: date numbers */}
              <tr style={{ background: 'var(--color-background)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, fontSize: 12, position: 'sticky', left: 0, background: 'var(--color-background)', zIndex: 11, minWidth: 200, borderRight: '2px solid var(--color-border)' }}>
                  Employee
                </th>
                {days.map((d: any) => (
                  <th key={d.date} style={{
                    padding: '6px 4px', textAlign: 'center', fontWeight: 700, minWidth: 64,
                    color: d.dow === 0 || d.dow === 6 ? '#ef4444' : 'var(--color-text)',
                    borderLeft: '1px solid var(--color-border)',
                  }}>
                    <div style={{ fontSize: 13, lineHeight: 1 }}>{d.day}</div>
                    <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.65, marginTop: 1 }}>{d.dowLabel}</div>
                  </th>
                ))}
                {/* Summary cols — only P, L, H, A */}
                {['P','L','H','A'].map(col => (
                  <th key={col} style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, fontSize: 12, minWidth: 36, borderLeft: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any, ri: number) => (
                <tr key={row.employeeId}
                  style={{ borderBottom: '1px solid var(--color-border)', background: ri % 2 === 0 ? 'var(--color-surface)' : 'var(--color-background)' }}>
                  {/* Employee name cell (sticky) */}
                  <td style={{
                    padding: '8px 14px', position: 'sticky', left: 0,
                    background: ri % 2 === 0 ? 'var(--color-surface)' : 'var(--color-background)',
                    zIndex: 5, borderRight: '2px solid var(--color-border)',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{row.firstName} {row.lastName}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                      {row.employeeCode}
                      {row.shiftName && (
                        <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, background: (row.shiftColor ?? '#6366f1') + '22', color: row.shiftColor ?? '#6366f1', fontWeight: 700 }}>
                          {row.shiftName}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Day cells */}
                  {row.days.map((day: any) => <MusterCell key={day.date} day={day} />)}

                  {/* Summary: P, L, H, A */}
                  {[row.totalP, row.totalL, row.totalH, row.totalA].map((val, vi) => (
                    <td key={vi} style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700, fontSize: 12, borderLeft: vi === 0 ? '2px solid var(--color-border)' : '1px solid var(--color-border)', color: val > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', flexShrink: 0, alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Legend:</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 6, background: '#dcfce7', fontSize: 11, fontWeight: 700, color: '#166534' }}>
          09:00 / 18:00 = Present
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 6, background: '#fef9c3', fontSize: 11, fontWeight: 700, color: '#854d0e' }}>
          09:30 / 18:00 = Late
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 6, background: '#ffedd5', fontSize: 11, fontWeight: 700, color: '#9a3412' }}>
          ½ = Half Day
        </div>
        {[
          { label: 'A = Absent' },
          { label: 'H = Holiday' },
          { label: 'WO = Week Off' },
          { label: 'LV = On Leave' },
        ].map(({ label }) => (
          <div key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 6, background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
