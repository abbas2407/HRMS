import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import api from '../../../lib/api';
import {
  IconSearch, IconDownload, IconFilter, IconEdit, IconX,
  IconMapPin, IconPhone, IconClock, IconCheck,
} from '@tabler/icons-react';

function fmt(d: string | Date | null, includeDate = false): string {
  if (!d) return '—';
  const dt = new Date(d);
  const time = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  if (!includeDate) return time;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + time;
}

function fmtDate(d: string): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  PRESENT:  { bg: '#dcfce7', color: '#166534', label: 'Approved' },
  LATE:     { bg: '#fef9c3', color: '#854d0e', label: 'Late' },
  HALF_DAY: { bg: '#ffedd5', color: '#9a3412', label: 'Half Day' },
  ABSENT:   { bg: '#fee2e2', color: '#991b1b', label: 'Absent' },
};

export default function EmployeeSwipesPage() {
  const qc = useQueryClient();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [empSearch, setEmpSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [editModal, setEditModal] = useState<any>(null);
  const [editIn, setEditIn] = useState('');
  const [editOut, setEditOut] = useState('');
  const [editRemarks, setEditRemarks] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['swipes', fromDate, toDate],
    queryFn: () =>
      api.get(`/attendance/swipes?from=${fromDate}&to=${toDate}&limit=200`).then(r => r.data.data),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.put(`/attendance/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['swipes'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      setEditModal(null);
    },
  });

  const rows: any[] = (data || []).filter((r: any) => {
    if (!empSearch) return true;
    const name = `${r.firstName} ${r.lastName}`.toLowerCase();
    return name.includes(empSearch.toLowerCase()) || r.employeeCode.includes(empSearch);
  });

  function openEdit(row: any) {
    setEditModal(row);
    setEditIn(row.punchIn ? new Date(row.punchIn).toTimeString().slice(0, 5) : '');
    setEditOut(row.punchOut ? new Date(row.punchOut).toTimeString().slice(0, 5) : '');
    setEditRemarks(row.remarks ?? '');
  }

  function saveEdit() {
    if (!editModal) return;
    const dateStr = editModal.date;
    const body: any = { remarks: editRemarks };
    if (editIn) body.punchIn = `${dateStr}T${editIn}:00`;
    if (editOut) body.punchOut = `${dateStr}T${editOut}:00`;
    editMutation.mutate({ id: editModal.id, body });
  }

  // CSV download — no colors, plain text
  function downloadCSV() {
    if (!rows.length) return;
    const header = ['Employee Code', 'Employee Name', 'Date', 'Punch In', 'Punch Out', 'Shift', 'Status', 'Source', 'Door/Location', 'Remarks'].join(',');
    const csvRows = rows.map(r => [
      r.employeeCode,
      `${r.firstName} ${r.lastName}`,
      r.date,
      r.punchIn ? fmt(r.punchIn) : '',
      r.punchOut ? fmt(r.punchOut) : '',
      r.shiftName ?? '',
      r.status ?? '',
      r.source ?? '',
      r.officeLocationName ?? '',
      r.remarks ?? '',
    ].map(v => `"${v}"`).join(','));
    const csv = [header, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `employee-swipes-${fromDate}-to-${toDate}.csv`;
    a.click();
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 20, height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      {/* Left panel — table */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Employee Swipes</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            All punch IN / OUT records with detail view
          </p>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Select Dates *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 10px' }}>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                style={{ border: 'none', background: 'transparent', color: 'var(--color-text)', fontSize: 13, outline: 'none' }} />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>–</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                style={{ border: 'none', background: 'transparent', color: 'var(--color-text)', fontSize: 13, outline: 'none' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Employee Search</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 10px' }}>
              <IconSearch size={14} style={{ color: 'var(--color-text-secondary)' }} />
              <input value={empSearch} onChange={e => setEmpSearch(e.target.value)} placeholder="Search Employee..."
                style={{ border: 'none', background: 'transparent', color: 'var(--color-text)', fontSize: 13, outline: 'none', width: 160 }} />
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={downloadCSV} title="Download CSV"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, cursor: 'pointer' }}>
              <IconDownload size={14} /> Export
            </button>
            <button title="Filter"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, cursor: 'pointer' }}>
              <IconFilter size={14} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-background)', position: 'sticky', top: 0, zIndex: 1 }}>
                {['Employee Name', 'Swipe Time & Date', 'Shift', 'In/Out', 'Received On', 'Door/Address', 'Status', 'Edit'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading swipes...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No swipe records found for this range</td></tr>
              ) : rows.map((row: any) => {
                const sc = row.status ? STATUS_MAP[row.status] : null;
                const isSelected = selectedRow?.id === row.id;

                return (
                  <tr key={row.id} onClick={() => setSelectedRow(row)}
                    style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer', background: isSelected ? 'var(--color-primary)10' : 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-background)'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{row.firstName} {row.lastName}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>#{row.employeeCode}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.punchIn || row.date)}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{fmtDate(row.date)}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {row.shiftName ? (
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: (row.shiftColor ?? '#6366f1') + '20', color: row.shiftColor ?? '#6366f1', fontWeight: 700, fontSize: 11, border: `1px solid ${(row.shiftColor ?? '#6366f1')}40` }}>
                          {row.shiftName}
                        </span>
                      ) : <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {row.punchIn && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                          <span style={{ fontWeight: 700, color: '#22c55e', fontSize: 10 }}>IN</span>
                          <span>{fmt(row.punchIn)}</span>
                        </div>
                      )}
                      {row.punchOut && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, marginTop: 2 }}>
                          <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 10 }}>OUT</span>
                          <span>{fmt(row.punchOut)}</span>
                        </div>
                      )}
                      {!row.punchIn && !row.punchOut && <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      <div>{row.punchIn ? fmt(row.punchIn) : '—'}</div>
                      <div style={{ fontSize: 11 }}>{fmtDate(row.date)}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {row.officeLocationName ?? (row.punchInLat ? 'office' : '—')}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {sc ? (
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 600, fontSize: 11 }}>
                          {sc.label}
                        </span>
                      ) : <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={e => { e.stopPropagation(); openEdit(row); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', fontSize: 12, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        <IconEdit size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right detail panel */}
      <div style={{ width: 280, flexShrink: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!selectedRow ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center', padding: 20 }}>
            Click a row to view swipe details
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedRow.firstName} {selectedRow.lastName}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>#{selectedRow.employeeCode}</div>
              </div>
              <button onClick={() => setSelectedRow(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={16} /></button>
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Swipe Time */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Swipe Time</div>
                <div style={{ fontWeight: 700, fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{selectedRow.punchIn ? fmt(selectedRow.punchIn) : '—'}</div>
              </div>

              <div style={{ height: 1, background: 'var(--color-border)' }} />

              {/* Swipe Details */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Swipe Details</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Mobile Name', value: selectedRow.source === 'MOBILE' ? 'Mobile App' : (selectedRow.source ?? '—') },
                    { label: 'Access Card', value: '—' },
                    { label: 'Door/Address', value: selectedRow.officeLocationName ?? (selectedRow.punchInLat ? 'office' : '—') },
                    { label: 'Remarks', value: selectedRow.remarks ?? '—' },
                    { label: 'Mobile ID', value: selectedRow.employeeId?.slice(-12) ?? '—' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 1 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {(selectedRow.punchInLat || selectedRow.punchInLng) && (
                <>
                  <div style={{ height: 1, background: 'var(--color-border)' }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location Details</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Latitude</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{Number(selectedRow.punchInLat).toFixed(7)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Longitude</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{Number(selectedRow.punchInLng).toFixed(7)}</div>
                      </div>
                      {selectedRow.punchInLat && selectedRow.punchInLng && (
                        <a href={`https://www.google.com/maps?q=${selectedRow.punchInLat},${selectedRow.punchInLng}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-primary)', fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                          <IconMapPin size={12} /> Google Maps Link
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Edit IN/OUT Modal ── */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 28, width: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Edit Swipe Times</h3>
              <button onClick={() => setEditModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>

            <div style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--color-background)', borderRadius: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>{editModal.firstName} {editModal.lastName}</div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{fmtDate(editModal.date)}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>IN</span> Time
                  </label>
                  <input type="time" value={editIn} onChange={e => setEditIn(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '2px solid #22c55e', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box', fontSize: 14, fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    <span style={{ color: '#ef4444', fontWeight: 700 }}>OUT</span> Time
                  </label>
                  <input type="time" value={editOut} onChange={e => setEditOut(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '2px solid #ef4444', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box', fontSize: 14, fontWeight: 600 }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Remarks</label>
                <input value={editRemarks} onChange={e => setEditRemarks(e.target.value)} placeholder="Reason for correction..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)', boxSizing: 'border-box', fontSize: 13 }} />
              </div>
              <div style={{ padding: '8px 12px', background: '#fef9c3', borderRadius: 8, fontSize: 12, color: '#854d0e' }}>
                ⚠ Editing will update the attendance record. Original time: IN {editModal.punchIn ? fmt(editModal.punchIn) : '—'} · OUT {editModal.punchOut ? fmt(editModal.punchOut) : '—'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setEditModal(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>Cancel</button>
              <button onClick={saveEdit} disabled={editMutation.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                <IconCheck size={14} /> {editMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
