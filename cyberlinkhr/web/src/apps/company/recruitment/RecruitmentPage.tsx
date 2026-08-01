import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import {
  IconUserSearch, IconPlus, IconX, IconBriefcase, IconChevronRight,
  IconCalendarEvent, IconMail, IconPhone, IconBuilding, IconMapPin, IconUsers, IconClipboard,
} from '@tabler/icons-react';

const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];
const STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];
const INTERVIEW_MODES = ['VIDEO', 'PHONE', 'IN_PERSON'];

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  APPLIED: { bg: '#f1f5f9', text: '#475569' },
  SCREENING: { bg: '#dbeafe', text: '#1e40af' },
  INTERVIEW: { bg: '#fef3c7', text: '#92400e' },
  OFFER: { bg: '#ede9fe', text: '#5b21b6' },
  HIRED: { bg: '#dcfce7', text: '#166534' },
  REJECTED: { bg: '#fee2e2', text: '#991b1b' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: '#dcfce7', text: '#166534' },
  PAUSED: { bg: '#fef3c7', text: '#92400e' },
  CLOSED: { bg: '#f1f5f9', text: '#64748b' },
};

const TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-Time', PART_TIME: 'Part-Time', CONTRACT: 'Contract', INTERN: 'Internship',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
  color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box',
};

type View = 'postings' | 'pipeline';

export default function RecruitmentPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'HR_ADMIN';
  const qc = useQueryClient();

  const [view, setView] = useState<View>('postings');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [appDetail, setAppDetail] = useState<any>(null);

  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showAddApp, setShowAddApp] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const [showOutcome, setShowOutcome] = useState<any>(null);

  const [jobForm, setJobForm] = useState({
    title: '', jobType: 'FULL_TIME', location: '', openings: 1,
    description: '', requirements: '', closingDate: '',
  });
  const [appForm, setAppForm] = useState({
    applicantName: '', email: '', phone: '', currentCompany: '',
    currentRole: '', totalExperience: '', noticePeriod: '', expectedSalary: '',
  });
  const [interviewForm, setInterviewForm] = useState({
    scheduledAt: '', durationMinutes: 60, mode: 'VIDEO', location: '', notes: '',
    interviewers: '',
  });
  const [outcomeForm, setOutcomeForm] = useState({ outcome: 'PASS', feedback: '' });
  const [error, setError] = useState('');

  const { data: postings, isLoading: loadingPostings } = useQuery<any[]>({
    queryKey: ['job-postings'],
    queryFn: () => api.get('/recruitment/postings').then(r => r.data.data),
  });

  const { data: applications, isLoading: loadingApps } = useQuery<any[]>({
    queryKey: ['job-applications', selectedJob?.id],
    queryFn: () => api.get(`/recruitment/applications?jobId=${selectedJob.id}`).then(r => r.data.data),
    enabled: !!selectedJob,
  });

  const createJobMutation = useMutation({
    mutationFn: (body: any) => api.post('/recruitment/postings', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-postings'] });
      setShowCreateJob(false);
      setJobForm({ title: '', jobType: 'FULL_TIME', location: '', openings: 1, description: '', requirements: '', closingDate: '' });
      setError('');
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: any) => api.patch(`/recruitment/postings/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-postings'] }),
  });

  const addAppMutation = useMutation({
    mutationFn: (body: any) => api.post(`/recruitment/postings/${selectedJob.id}/apply`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-applications', selectedJob?.id] });
      setShowAddApp(false);
      setAppForm({ applicantName: '', email: '', phone: '', currentCompany: '', currentRole: '', totalExperience: '', noticePeriod: '', expectedSalary: '' });
      setError('');
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: any) => api.patch(`/recruitment/applications/${id}/stage`, { stage }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-applications', selectedJob?.id] });
      if (appDetail) openAppDetail(appDetail.id);
    },
  });

  const interviewMutation = useMutation({
    mutationFn: ({ id, body }: any) => api.post(`/recruitment/applications/${id}/interviews`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-applications', selectedJob?.id] });
      setShowInterview(false);
      setError('');
      if (appDetail) openAppDetail(appDetail.id);
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const outcomeMutation = useMutation({
    mutationFn: ({ interviewId, body }: any) => api.patch(`/recruitment/interviews/${interviewId}/outcome`, body),
    onSuccess: () => {
      setShowOutcome(null);
      if (appDetail) openAppDetail(appDetail.id);
    },
  });

  const openAppDetail = async (id: string) => {
    const res = await api.get(`/recruitment/applications/${id}`);
    setAppDetail(res.data.data);
    setSelectedApp(res.data.data);
  };

  const openPipeline = (job: any) => {
    setSelectedJob(job);
    setView('pipeline');
  };

  // Group applications by stage
  const byStage = (apps: any[]) => {
    const map: Record<string, any[]> = {};
    STAGES.forEach(s => { map[s] = []; });
    (apps || []).forEach(a => { if (map[a.stage]) map[a.stage].push(a); });
    return map;
  };

  const pipeline = byStage(applications || []);
  const totalApps = (applications || []).length;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconUserSearch size={20} style={{ color: 'var(--brand)' }} />
          </div>
          <div>
            {view === 'postings' ? (
              <>
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Recruitment</h1>
                <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 13 }}>Manage job postings and candidate pipeline</p>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setView('postings')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 13, padding: 0 }}>
                    Recruitment
                  </button>
                  <IconChevronRight size={14} style={{ color: 'var(--text-3)' }} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{selectedJob?.title}</span>
                </div>
                <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 13 }}>
                  {totalApps} applicant{totalApps !== 1 ? 's' : ''} · {selectedJob?.location || 'Remote'} · {TYPE_LABELS[selectedJob?.jobType]}
                </p>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {view === 'postings' && isAdmin && (
            <button onClick={() => setShowCreateJob(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              <IconPlus size={15} /> New Job
            </button>
          )}
          {view === 'pipeline' && isAdmin && (
            <button onClick={() => { setShowAddApp(true); setError(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              <IconPlus size={15} /> Add Applicant
            </button>
          )}
        </div>
      </div>

      {/* Postings list */}
      {view === 'postings' && (
        <>
          {loadingPostings ? <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 40 }}>Loading...</div>
            : !(postings || []).length ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)', border: '1px dashed var(--border)', borderRadius: 12 }}>
                <IconUserSearch size={40} style={{ opacity: 0.25, display: 'block', margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>No job postings yet</div>
                <div style={{ fontSize: 13 }}>Create your first job posting to start receiving applications</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {(postings || []).map((job: any) => {
                  const sc = STATUS_COLORS[job.status] || STATUS_COLORS.OPEN;
                  return (
                    <div key={job.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{job.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                            {job.departmentName || 'All Departments'} · {TYPE_LABELS[job.jobType]}
                          </div>
                        </div>
                        <span style={{ background: sc.bg, color: sc.text, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{job.status}</span>
                      </div>

                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-3)', flexWrap: 'wrap' }}>
                        {job.location && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IconMapPin size={11} />{job.location}</span>}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IconUsers size={11} />{job.openings} opening{job.openings !== 1 ? 's' : ''}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IconClipboard size={11} />{job.applicationCount} applied</span>
                      </div>

                      {job.closingDate && (
                        <div style={{ fontSize: 11, color: '#f59e0b' }}>
                          Closes {new Date(job.closingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button onClick={() => openPipeline(job)}
                          style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          View Pipeline
                        </button>
                        {isAdmin && job.status === 'OPEN' && (
                          <button onClick={() => statusMutation.mutate({ id: job.id, status: 'CLOSED' })}
                            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #fecaca', background: 'none', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>
                            Close
                          </button>
                        )}
                        {isAdmin && job.status === 'CLOSED' && (
                          <button onClick={() => statusMutation.mutate({ id: job.id, status: 'OPEN' })}
                            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #bbf7d0', background: 'none', cursor: 'pointer', fontSize: 12, color: '#166534' }}>
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </>
      )}

      {/* Pipeline (Kanban) */}
      {view === 'pipeline' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 220px)', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
          {STAGES.map(stage => {
            const sc = STAGE_COLORS[stage];
            const cards = pipeline[stage] || [];
            return (
              <div key={stage} style={{ background: 'var(--color-background)', borderRadius: 12, padding: 12, minHeight: 300 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ background: sc.bg, color: sc.text, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{stage}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{cards.length}</span>
                </div>
                {cards.map((app: any) => (
                  <div key={app.id} onClick={() => openAppDetail(app.id)}
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, marginBottom: 8, cursor: 'pointer' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{app.applicantName}</div>
                    {app.currentRole && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{app.currentRole}</div>}
                    {app.currentCompany && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{app.currentCompany}</div>}
                    {app.totalExperience && <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 4 }}>Exp: {app.totalExperience}</div>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Applicant detail side panel */}
      {appDetail && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', zIndex: 500, overflowY: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.12)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{appDetail.applicantName}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{appDetail.jobTitle}</div>
            </div>
            <button onClick={() => { setAppDetail(null); setSelectedApp(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
          </div>

          <div style={{ padding: '16px 20px' }}>
            {/* Stage badge + progression */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ ...STAGE_COLORS[appDetail.stage], padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{appDetail.stage}</span>
            </div>

            {/* Contact info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconMail size={13} color="var(--color-text-secondary)" />{appDetail.email}</div>
              {appDetail.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconPhone size={13} color="var(--color-text-secondary)" />{appDetail.phone}</div>}
              {appDetail.currentCompany && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconBuilding size={13} color="var(--color-text-secondary)" />{appDetail.currentRole} @ {appDetail.currentCompany}</div>}
            </div>

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                ['Experience', appDetail.totalExperience],
                ['Notice Period', appDetail.noticePeriod],
                ['Expected CTC', appDetail.expectedSalary],
                ['Applied', new Date(appDetail.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={{ background: 'var(--color-background)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Move stage */}
            {isAdmin && appDetail.status === 'ACTIVE' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>MOVE TO STAGE</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {STAGES.filter(s => s !== appDetail.stage).map(s => {
                    const sc = STAGE_COLORS[s];
                    return (
                      <button key={s} onClick={() => stageMutation.mutate({ id: appDetail.id, stage: s })}
                        style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${sc.bg}`, background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: sc.text }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Schedule interview */}
            {isAdmin && appDetail.status === 'ACTIVE' && (
              <div style={{ marginBottom: 16 }}>
                <button onClick={() => { setShowInterview(true); setError(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <IconCalendarEvent size={14} /> Schedule Interview
                </button>
              </div>
            )}

            {/* Interviews */}
            {(appDetail.interviews || []).length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>INTERVIEWS</div>
                {appDetail.interviews.map((iv: any) => (
                  <div key={iv.id} style={{ background: 'var(--color-background)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {new Date(iv.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(iv.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{iv.mode} · {iv.durationMinutes} min</div>
                      </div>
                      {iv.outcome && (
                        <span style={{
                          background: iv.outcome === 'PASS' ? '#dcfce7' : iv.outcome === 'FAIL' ? '#fee2e2' : '#fef3c7',
                          color: iv.outcome === 'PASS' ? '#166534' : iv.outcome === 'FAIL' ? '#991b1b' : '#92400e',
                          padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                        }}>{iv.outcome}</span>
                      )}
                    </div>
                    {iv.notes && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{iv.notes}</div>}
                    {isAdmin && !iv.outcome && (
                      <button onClick={() => { setShowOutcome(iv); setOutcomeForm({ outcome: 'PASS', feedback: '' }); }}
                        style={{ marginTop: 6, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                        Record Outcome
                      </button>
                    )}
                    {iv.feedback && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4, fontStyle: 'italic' }}>"{iv.feedback}"</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create job modal */}
      {showCreateJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Create Job Posting</div>
              <button onClick={() => setShowCreateJob(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Job Title *</label>
                <input style={inputStyle} placeholder="e.g. Senior React Developer" value={jobForm.title} onChange={e => setJobForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Job Type</label>
                  <select style={inputStyle} value={jobForm.jobType} onChange={e => setJobForm(f => ({ ...f, jobType: e.target.value }))}>
                    {JOB_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Openings</label>
                  <input type="number" min={1} style={inputStyle} value={jobForm.openings} onChange={e => setJobForm(f => ({ ...f, openings: Number(e.target.value) }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Location</label>
                  <input style={inputStyle} placeholder="e.g. Bangalore / Remote" value={jobForm.location} onChange={e => setJobForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Closing Date</label>
                  <input type="date" style={inputStyle} value={jobForm.closingDate} onChange={e => setJobForm(f => ({ ...f, closingDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Job Description</label>
                <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} placeholder="Role overview, responsibilities..." value={jobForm.description} onChange={e => setJobForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Requirements</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Skills, experience, qualifications..." value={jobForm.requirements} onChange={e => setJobForm(f => ({ ...f, requirements: e.target.value }))} />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCreateJob(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => createJobMutation.mutate(jobForm)} disabled={createJobMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {createJobMutation.isPending ? 'Creating...' : 'Post Job'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add applicant modal */}
      {showAddApp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Add Applicant</div>
              <button onClick={() => setShowAddApp(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Full Name *</label>
                  <input style={inputStyle} value={appForm.applicantName} onChange={e => setAppForm(f => ({ ...f, applicantName: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Email *</label>
                  <input type="email" style={inputStyle} value={appForm.email} onChange={e => setAppForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Phone</label>
                  <input style={inputStyle} value={appForm.phone} onChange={e => setAppForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Total Experience</label>
                  <input style={inputStyle} placeholder="e.g. 4 years" value={appForm.totalExperience} onChange={e => setAppForm(f => ({ ...f, totalExperience: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Current Company</label>
                  <input style={inputStyle} value={appForm.currentCompany} onChange={e => setAppForm(f => ({ ...f, currentCompany: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Current Role</label>
                  <input style={inputStyle} value={appForm.currentRole} onChange={e => setAppForm(f => ({ ...f, currentRole: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Notice Period</label>
                  <input style={inputStyle} placeholder="e.g. 30 days" value={appForm.noticePeriod} onChange={e => setAppForm(f => ({ ...f, noticePeriod: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Expected Salary</label>
                  <input style={inputStyle} placeholder="e.g. 15 LPA" value={appForm.expectedSalary} onChange={e => setAppForm(f => ({ ...f, expectedSalary: e.target.value }))} />
                </div>
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAddApp(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => addAppMutation.mutate(appForm)} disabled={addAppMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {addAppMutation.isPending ? 'Adding...' : 'Add Applicant'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule interview modal */}
      {showInterview && appDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 460 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Schedule Interview</div>
              <button onClick={() => setShowInterview(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Date & Time *</label>
                  <input type="datetime-local" style={inputStyle} value={interviewForm.scheduledAt} onChange={e => setInterviewForm(f => ({ ...f, scheduledAt: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Duration (min)</label>
                  <input type="number" style={inputStyle} value={interviewForm.durationMinutes} onChange={e => setInterviewForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Mode</label>
                  <select style={inputStyle} value={interviewForm.mode} onChange={e => setInterviewForm(f => ({ ...f, mode: e.target.value }))}>
                    {INTERVIEW_MODES.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Location / Link</label>
                  <input style={inputStyle} placeholder="Meet link or room" value={interviewForm.location} onChange={e => setInterviewForm(f => ({ ...f, location: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Interviewers (emails, comma-separated)</label>
                <input style={inputStyle} placeholder="hr@company.com, tech@company.com" value={interviewForm.interviewers} onChange={e => setInterviewForm(f => ({ ...f, interviewers: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={interviewForm.notes} onChange={e => setInterviewForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowInterview(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => interviewMutation.mutate({
                  id: appDetail.id,
                  body: { ...interviewForm, interviewers: interviewForm.interviewers.split(',').map((s: string) => s.trim()).filter(Boolean) }
                })} disabled={interviewMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {interviewMutation.isPending ? 'Scheduling...' : 'Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record outcome modal */}
      {showOutcome && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 400 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Record Interview Outcome</div>
              <button onClick={() => setShowOutcome(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Outcome</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['PASS', 'FAIL', 'ON_HOLD'].map(o => (
                    <button key={o} onClick={() => setOutcomeForm(f => ({ ...f, outcome: o }))}
                      style={{ flex: 1, padding: '8px', borderRadius: 9, border: `2px solid ${outcomeForm.outcome === o ? 'var(--color-primary)' : 'var(--color-border)'}`, background: outcomeForm.outcome === o ? 'var(--color-primary)' : 'none', color: outcomeForm.outcome === o ? '#fff' : 'var(--color-text)', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                      {o.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Feedback</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={outcomeForm.feedback} onChange={e => setOutcomeForm(f => ({ ...f, feedback: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowOutcome(null)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => outcomeMutation.mutate({ interviewId: showOutcome.id, body: outcomeForm })} disabled={outcomeMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {outcomeMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
