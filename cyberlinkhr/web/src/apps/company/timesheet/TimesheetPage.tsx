import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { IconClock, IconChevronLeft, IconChevronRight, IconCheck, IconX, IconPlus } from '@tabler/icons-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return toDateStr(d);
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT:     { bg: '#f3f4f6', color: '#6b7280', label: 'Draft' },
  SUBMITTED: { bg: '#eff6ff', color: '#3b82f6', label: 'Submitted' },
  APPROVED:  { bg: '#f0fdf4', color: '#22c55e', label: 'Approved' },
  REJECTED:  { bg: '#fef2f2', color: '#ef4444', label: 'Rejected' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.DRAFT;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Project Manager Modal (HR only) ──────────────────────────────────────────
function ProjectModal({ projects, onClose, onRefresh }: { projects: any[]; onClose: () => void; onRefresh: () => void }) {
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [billable, setBillable] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post('/timesheet/projects', { name: name.trim(), clientName: clientName.trim() || undefined, billable });
      setName(''); setClientName(''); setBillable(true);
      onRefresh();
    } finally { setSaving(false); }
  };

  const handleArchive = async (id: string) => {
    await api.patch(`/timesheet/projects/${id}`, { status: 'ARCHIVED' });
    onRefresh();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: 28, width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Manage Projects</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Project name *"
            style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, background: 'var(--color-bg)', color: 'inherit' }} />
          <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client"
            style={{ width: 120, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, background: 'var(--color-bg)', color: 'inherit' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
            <input type="checkbox" checked={billable} onChange={e => setBillable(e.target.checked)} /> Billable
          </label>
          <button onClick={handleCreate} disabled={saving || !name.trim()}
            style={{ padding: '8px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Add
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {projects.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                {p.clientName && <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 8 }}>{p.clientName}</span>}
                {p.billable && <span style={{ fontSize: 10, marginLeft: 6, padding: '1px 6px', background: '#eff6ff', color: '#3b82f6', borderRadius: 99, fontWeight: 700 }}>Billable</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <StatusBadge status={p.status === 'ACTIVE' ? 'APPROVED' : 'REJECTED'} />
                {p.status === 'ACTIVE' && (
                  <button onClick={() => handleArchive(p.id)}
                    style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--color-border)', background: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Review Modal (Manager/HR) ─────────────────────────────────────────────────
function ReviewModal({ employee, weekStart, onClose, onDone }: { employee: any; weekStart: string; onClose: () => void; onDone: () => void }) {
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: detail } = useQuery<any[]>({
    queryKey: ['ts-detail', employee.employeeId, weekStart],
    queryFn: () => api.get(`/timesheet/team/${employee.employeeId}?weekStart=${weekStart}`).then(r => r.data.data),
  });

  const handleReview = async (action: 'APPROVED' | 'REJECTED') => {
    setSaving(true);
    try {
      await api.patch(`/timesheet/team/${employee.employeeId}/review`, { weekStart, action, reviewNote });
      onDone();
    } finally { setSaving(false); }
  };

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const grouped: Record<string, any[]> = {};
  (detail || []).forEach(e => {
    if (!grouped[e.projectId]) grouped[e.projectId] = [];
    grouped[e.projectId].push(e);
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{employee.employeeName}</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>Week of {fmtDate(weekStart)} · {employee.totalHours?.toFixed(1)}h total</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
        </div>

        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Project</th>
                {weekDates.map((d, i) => (
                  <th key={d} style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: 52 }}>{DAYS[i]}<br /><span style={{ fontSize: 10, fontWeight: 400 }}>{fmtDate(d)}</span></th>
                ))}
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([projId, entries]) => {
                const byDate: Record<string, number> = {};
                entries.forEach(e => { byDate[e.entryDate] = Number(e.hours); });
                const total = entries.reduce((s, e) => s + Number(e.hours), 0);
                return (
                  <tr key={projId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 10px', fontWeight: 500 }}>{entries[0]?.projectName}</td>
                    {weekDates.map(d => (
                      <td key={d} style={{ padding: '10px 8px', textAlign: 'center', color: byDate[d] ? 'inherit' : 'var(--color-text-secondary)' }}>
                        {byDate[d] ? byDate[d].toFixed(1) : '—'}
                      </td>
                    ))}
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>{total.toFixed(1)}h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {employee.status === 'SUBMITTED' && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Review note (optional)"
              rows={2} style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 13, resize: 'none', background: 'var(--color-bg)', color: 'inherit' }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => handleReview('REJECTED')} disabled={saving}
                style={{ padding: '8px 18px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Reject
              </button>
              <button onClick={() => handleReview('APPROVED')} disabled={saving}
                style={{ padding: '8px 18px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Approve
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TimesheetPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'HR_ADMIN';
  const isManager = user?.role === 'MANAGER' || isAdmin;

  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [view, setView] = useState<'my' | 'team'>('my');
  const [showProjModal, setShowProjModal] = useState(false);
  const [reviewEmp, setReviewEmp] = useState<any>(null);
  const [editHours, setEditHours] = useState<Record<string, string>>({});

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: projectsData = [], refetch: refetchProjects } = useQuery<any[]>({
    queryKey: ['ts-projects'],
    queryFn: () => api.get('/timesheet/projects').then(r => r.data.data),
  });
  const activeProjects = projectsData.filter((p: any) => p.status === 'ACTIVE');

  const { data: myWeek } = useQuery<{ data: any[]; weekStart: string }>({
    queryKey: ['ts-my-week', weekStart],
    queryFn: () => api.get(`/timesheet/my-week?weekStart=${weekStart}`).then(r => r.data),
    enabled: view === 'my',
  });

  const { data: teamData } = useQuery<{ data: any[]; weekStart: string }>({
    queryKey: ['ts-team', weekStart],
    queryFn: () => api.get(`/timesheet/team?weekStart=${weekStart}`).then(r => r.data),
    enabled: view === 'team' && isManager,
  });

  const upsertMutation = useMutation({
    mutationFn: (body: any) => api.post('/timesheet/entries', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ts-my-week', weekStart] }),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post('/timesheet/submit', { weekStart }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ts-my-week', weekStart] }),
  });

  // Build a lookup: projectId + date → hours
  const hoursMap = useMemo(() => {
    const m: Record<string, number> = {};
    (myWeek?.data || []).forEach(e => {
      m[`${e.projectId}__${e.entryDate}`] = Number(e.hours);
    });
    return m;
  }, [myWeek]);

  const weekStatus = useMemo(() => {
    const entries = myWeek?.data || [];
    if (!entries.length) return 'DRAFT';
    const statuses = new Set(entries.map((e: any) => e.status));
    if (statuses.has('SUBMITTED')) return 'SUBMITTED';
    if (statuses.has('APPROVED')) return 'APPROVED';
    if (statuses.has('REJECTED')) return 'REJECTED';
    return 'DRAFT';
  }, [myWeek]);

  const totalHours = useMemo(() =>
    Object.values(hoursMap).reduce((s, h) => s + h, 0), [hoursMap]);

  const handleBlur = async (projectId: string, date: string) => {
    const key = `${projectId}__${date}`;
    const val = editHours[key];
    if (val === undefined) return;
    const h = parseFloat(val);
    if (isNaN(h)) return;
    await upsertMutation.mutateAsync({ projectId, entryDate: date, hours: h });
    setEditHours(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const navWeek = (delta: number) => {
    const d = new Date(weekStart + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta * 7);
    setWeekStart(toDateStr(d));
  };

  const canEdit = weekStatus === 'DRAFT' || weekStatus === 'REJECTED';
  const canSubmit = weekStatus === 'DRAFT' && totalHours > 0;

  return (
    <div style={{ padding: 24 }}>
      {showProjModal && (
        <ProjectModal projects={projectsData} onClose={() => setShowProjModal(false)} onRefresh={() => { refetchProjects(); }} />
      )}
      {reviewEmp && (
        <ReviewModal employee={reviewEmp} weekStart={weekStart} onClose={() => setReviewEmp(null)}
          onDone={() => { setReviewEmp(null); qc.invalidateQueries({ queryKey: ['ts-team', weekStart] }); }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconClock size={22} color="var(--color-primary)" />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Timesheet</h1>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>Track hours per project, per day</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin && (
            <button onClick={() => setShowProjModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', border: '1px solid var(--color-border)', background: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <IconPlus size={13} /> Projects
            </button>
          )}
          {isManager && (
            <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 9, overflow: 'hidden' }}>
              {(['my', 'team'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  style={{ padding: '8px 16px', border: 'none', background: view === v ? 'var(--color-primary)' : 'none', color: view === v ? '#fff' : 'inherit', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  {v === 'my' ? 'My Timesheet' : 'Team'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <button onClick={() => navWeek(-1)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}><IconChevronLeft size={16} /></button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>
          {fmtDate(weekStart)} – {fmtDate(addDays(weekStart, 6))}
        </span>
        <button onClick={() => navWeek(1)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}><IconChevronRight size={16} /></button>
        <button onClick={() => setWeekStart(getWeekStart(new Date()))}
          style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          This week
        </button>
      </div>

      {/* ── MY TIMESHEET VIEW ── */}
      {view === 'my' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusBadge status={weekStatus} />
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{totalHours.toFixed(1)}h logged this week</span>
            </div>
            {canSubmit && (
              <button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 18px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                <IconCheck size={14} /> Submit Week
              </button>
            )}
          </div>

          {!activeProjects.length ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
              No active projects yet. {isAdmin ? 'Add a project using the Projects button above.' : 'Ask HR to add projects.'}
            </div>
          ) : (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-surface)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg)', borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: 180 }}>Project</th>
                      {weekDates.map((d, i) => {
                        const dayTotal = activeProjects.reduce((s, p) => s + (hoursMap[`${p.id}__${d}`] || 0), 0);
                        return (
                          <th key={d} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: 70 }}>
                            <div>{DAYS[i]}</div>
                            <div style={{ fontSize: 10, fontWeight: 400 }}>{fmtDate(d)}</div>
                            {dayTotal > 0 && <div style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 700, marginTop: 2 }}>{dayTotal.toFixed(1)}h</div>}
                          </th>
                        );
                      })}
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeProjects.map((p: any, pi: number) => {
                      const rowTotal = weekDates.reduce((s, d) => s + (hoursMap[`${p.id}__${d}`] || 0), 0);
                      return (
                        <tr key={p.id} style={{ borderBottom: pi < activeProjects.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            {p.clientName && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{p.clientName}</div>}
                            {p.billable && <span style={{ fontSize: 9, padding: '1px 5px', background: '#eff6ff', color: '#3b82f6', borderRadius: 99, fontWeight: 700 }}>Billable</span>}
                          </td>
                          {weekDates.map(d => {
                            const key = `${p.id}__${d}`;
                            const saved = hoursMap[key];
                            const editing = editHours[key];
                            const displayVal = editing !== undefined ? editing : (saved !== undefined ? String(saved) : '');
                            const locked = !canEdit;
                            return (
                              <td key={d} style={{ padding: '6px 4px', textAlign: 'center' }}>
                                <input
                                  type="number" min={0} max={24} step={0.5}
                                  value={displayVal}
                                  disabled={locked}
                                  placeholder="—"
                                  onChange={e => setEditHours(prev => ({ ...prev, [key]: e.target.value }))}
                                  onBlur={() => handleBlur(p.id, d)}
                                  style={{
                                    width: 54, padding: '5px 4px', textAlign: 'center',
                                    border: `1px solid ${editing !== undefined ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                    borderRadius: 7, fontSize: 13, background: locked ? 'var(--color-bg)' : 'var(--color-surface)',
                                    color: 'inherit', opacity: locked ? 0.6 : 1,
                                  }}
                                />
                              </td>
                            );
                          })}
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>
                            {rowTotal > 0 ? `${rowTotal.toFixed(1)}h` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total row */}
                    <tr style={{ background: 'var(--color-bg)', borderTop: '2px solid var(--color-border)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 700 }}>Daily Total</td>
                      {weekDates.map(d => {
                        const t = activeProjects.reduce((s: number, p: any) => s + (hoursMap[`${p.id}__${d}`] || 0), 0);
                        return (
                          <td key={d} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>
                            {t > 0 ? `${t.toFixed(1)}h` : '—'}
                          </td>
                        );
                      })}
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--color-primary)' }}>
                        {totalHours.toFixed(1)}h
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {weekStatus === 'REJECTED' && (
            <div style={{ marginTop: 14, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13 }}>
              Your timesheet was rejected. Please update and re-submit.
            </div>
          )}
        </>
      )}

      {/* ── TEAM VIEW ── */}
      {view === 'team' && isManager && (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                {['Employee', 'Code', 'Total Hours', 'Status', 'Submitted At', 'Action'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!(teamData?.data || []).length ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No timesheets submitted for this week.</td></tr>
              ) : (teamData?.data || []).map((emp: any, idx: number) => (
                <tr key={emp.employeeId} style={{ borderBottom: idx < (teamData?.data || []).length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>{emp.employeeName}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{emp.employeeCode}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>{Number(emp.totalHours).toFixed(1)}h</td>
                  <td style={{ padding: '12px 14px' }}><StatusBadge status={emp.status} /></td>
                  <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)', fontSize: 12 }}>
                    {emp.submittedAt ? new Date(emp.submittedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => setReviewEmp(emp)}
                      style={{ padding: '5px 12px', border: '1px solid var(--color-border)', background: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      {emp.status === 'SUBMITTED' ? 'Review' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
