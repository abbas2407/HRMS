import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import {
  IconClipboardList, IconPlus, IconX, IconTrash, IconChartBar,
  IconCheck, IconChevronRight, IconArrowLeft,
} from '@tabler/icons-react';

const Q_TYPES = ['TEXT', 'RATING', 'MULTIPLE_CHOICE', 'YES_NO'] as const;
type QType = typeof Q_TYPES[number];

const Q_LABELS: Record<QType, string> = {
  TEXT: 'Open Text',
  RATING: 'Rating (1–5)',
  MULTIPLE_CHOICE: 'Multiple Choice',
  YES_NO: 'Yes / No',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: '#f1f5f9', text: '#64748b' },
  ACTIVE: { bg: '#dcfce7', text: '#166534' },
  CLOSED: { bg: '#fee2e2', text: '#991b1b' },
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
  color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box',
};

const emptyQuestion = () => ({
  questionText: '', questionType: 'TEXT' as QType, options: ['', ''], required: true,
});

type PageView = 'list' | 'take' | 'analytics';

export default function SurveysPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'HR_ADMIN';
  const qc = useQueryClient();

  const [pageView, setPageView] = useState<PageView>('list');
  const [activeSurvey, setActiveSurvey] = useState<any>(null);
  const [surveyDetail, setSurveyDetail] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [surveyForm, setSurveyForm] = useState({
    title: '', description: '', type: 'NAMED', deadline: '', targetRole: '',
  });
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const { data: list, isLoading } = useQuery<any[]>({
    queryKey: ['surveys'],
    queryFn: () => api.get('/surveys').then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/surveys', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surveys'] });
      setShowCreate(false);
      setSurveyForm({ title: '', description: '', type: 'NAMED', deadline: '', targetRole: '' });
      setQuestions([emptyQuestion()]);
      setError('');
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: any) => api.patch(`/surveys/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['surveys'] }),
  });

  const submitMutation = useMutation({
    mutationFn: ({ id, body }: any) => api.post(`/surveys/${id}/respond`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surveys'] });
      setSubmitted(true);
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed'),
  });

  const openTake = async (survey: any) => {
    const res = await api.get(`/surveys/${survey.id}`);
    setSurveyDetail(res.data.data);
    setActiveSurvey(survey);
    setAnswers({});
    setSubmitted(false);
    setError('');
    setPageView('take');
  };

  const openAnalytics = async (survey: any) => {
    const res = await api.get(`/surveys/${survey.id}/analytics`);
    setAnalyticsData(res.data.data);
    setActiveSurvey(survey);
    setPageView('analytics');
  };

  const updateQuestion = (i: number, field: string, value: any) =>
    setQuestions(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: value }; return n; });

  const updateOption = (qi: number, oi: number, value: string) =>
    setQuestions(prev => {
      const n = [...prev];
      const opts = [...n[qi].options];
      opts[oi] = value;
      n[qi] = { ...n[qi], options: opts };
      return n;
    });

  const buildAnswers = () =>
    (surveyDetail?.questions || []).map((q: any) => ({
      questionId: q.id,
      answerText: q.questionType === 'TEXT' ? (answers[q.id] || '') : null,
      answerRating: q.questionType === 'RATING' ? (answers[q.id] ?? null) : null,
      answerChoice: (q.questionType === 'MULTIPLE_CHOICE' || q.questionType === 'YES_NO') ? (answers[q.id] || null) : null,
    }));

  const pending = (list || []).filter(s => s.status === 'ACTIVE' && !s.myResponse).length;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconClipboardList size={22} color="var(--color-primary)" />
          <div>
            {pageView === 'list' ? (
              <>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Surveys</h1>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>Employee feedback and engagement surveys</p>
              </>
            ) : pageView === 'take' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setPageView('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                  <IconArrowLeft size={14} /> Surveys
                </button>
                <IconChevronRight size={14} color="var(--color-text-secondary)" />
                <span style={{ fontSize: 14, fontWeight: 700 }}>{activeSurvey?.title}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setPageView('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                  <IconArrowLeft size={14} /> Surveys
                </button>
                <IconChevronRight size={14} color="var(--color-text-secondary)" />
                <span style={{ fontSize: 14, fontWeight: 700 }}>Analytics — {activeSurvey?.title}</span>
              </div>
            )}
          </div>
        </div>
        {pageView === 'list' && isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {pending > 0 && (
              <div style={{ background: '#fef3c7', color: '#92400e', padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                {pending} awaiting your response
              </div>
            )}
            <button onClick={() => setShowCreate(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
              <IconPlus size={16} /> Create Survey
            </button>
          </div>
        )}
      </div>

      {/* Survey list */}
      {pageView === 'list' && (
        <>
          {isLoading ? <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
            : !(list || []).length ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
                <IconClipboardList size={40} style={{ opacity: 0.25, display: 'block', margin: '0 auto 12px' }} />
                No surveys yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(list || []).map((s: any) => {
                  const sc = STATUS_COLORS[s.status] || STATUS_COLORS.DRAFT;
                  const alreadyDone = s.myResponse && !isAdmin;
                  return (
                    <div key={s.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{s.title}</span>
                          <span style={{ background: sc.bg, color: sc.text, padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{s.status}</span>
                          {s.type === 'ANONYMOUS' && <span style={{ background: '#f0fdf4', color: '#166534', padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>ANONYMOUS</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', gap: 12 }}>
                          {isAdmin && <span>👥 {s.responseCount} responses</span>}
                          {s.deadline && <span>⏰ Closes {new Date(s.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                          {s.targetRole && <span>🎯 {s.targetRole}</span>}
                          {alreadyDone && <span style={{ color: '#059669' }}>✓ Submitted</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        {isAdmin && (
                          <>
                            {s.status === 'DRAFT' && (
                              <button onClick={() => statusMutation.mutate({ id: s.id, status: 'ACTIVE' })}
                                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #bbf7d0', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#166534' }}>
                                Activate
                              </button>
                            )}
                            {s.status === 'ACTIVE' && (
                              <button onClick={() => statusMutation.mutate({ id: s.id, status: 'CLOSED' })}
                                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #fecaca', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#dc2626' }}>
                                Close
                              </button>
                            )}
                            <button onClick={() => openAnalytics(s)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 12 }}>
                              <IconChartBar size={13} /> Analytics
                            </button>
                          </>
                        )}
                        {!isAdmin && s.status === 'ACTIVE' && !alreadyDone && (
                          <button onClick={() => openTake(s)}
                            style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                            Fill Survey
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

      {/* Take survey */}
      {pageView === 'take' && surveyDetail && (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ width: 60, height: 60, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <IconCheck size={28} color="#166534" />
              </div>
              <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Thank you!</h2>
              <p style={{ color: 'var(--color-text-secondary)' }}>Your response has been recorded.</p>
              <button onClick={() => setPageView('list')} style={{ marginTop: 16, padding: '9px 20px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                Back to Surveys
              </button>
            </div>
          ) : (
            <>
              {surveyDetail.description && (
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24, fontSize: 14 }}>{surveyDetail.description}</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {(surveyDetail.questions || []).map((q: any, idx: number) => (
                  <div key={q.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                    <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
                      {idx + 1}. {q.questionText}
                      {q.required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
                    </div>

                    {q.questionType === 'TEXT' && (
                      <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                        placeholder="Your answer..."
                        value={answers[q.id] || ''}
                        onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
                    )}

                    {q.questionType === 'RATING' && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} onClick={() => setAnswers(a => ({ ...a, [q.id]: n }))}
                            style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid ${answers[q.id] === n ? 'var(--color-primary)' : 'var(--color-border)'}`, background: answers[q.id] === n ? 'var(--color-primary)' : 'none', color: answers[q.id] === n ? '#fff' : 'var(--color-text)', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
                            {n}
                          </button>
                        ))}
                        {answers[q.id] && <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 4 }}>Selected: {answers[q.id]}</span>}
                      </div>
                    )}

                    {q.questionType === 'MULTIPLE_CHOICE' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(q.options || []).filter((o: string) => o).map((opt: string) => (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                            <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === opt} onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}

                    {q.questionType === 'YES_NO' && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        {['Yes', 'No'].map(opt => (
                          <button key={opt} onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                            style={{ padding: '8px 24px', borderRadius: 9, border: `2px solid ${answers[q.id] === opt ? 'var(--color-primary)' : 'var(--color-border)'}`, background: answers[q.id] === opt ? 'var(--color-primary)' : 'none', color: answers[q.id] === opt ? '#fff' : 'var(--color-text)', cursor: 'pointer', fontWeight: 700 }}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 12 }}>{error}</div>}
              <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setPageView('list')} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => submitMutation.mutate({ id: activeSurvey.id, body: { answers: buildAnswers() } })}
                  disabled={submitMutation.isPending}
                  style={{ padding: '9px 20px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {submitMutation.isPending ? 'Submitting...' : 'Submit Response'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Analytics */}
      {pageView === 'analytics' && analyticsData && (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary)' }}>{analyticsData.totalResponses}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Total Responses</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 20 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Survey</div>
              <div style={{ fontWeight: 700 }}>{analyticsData.survey.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{analyticsData.survey.type}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(analyticsData.questions || []).map((q: any, idx: number) => (
              <div key={q.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>{idx + 1}. {q.questionText}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 14 }}>{Q_LABELS[q.questionType as QType]} · {q.answerCount} answer{q.answerCount !== 1 ? 's' : ''}</div>

                {q.questionType === 'RATING' && (
                  <>
                    {q.avg && (
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary)', marginBottom: 12 }}>
                        {q.avg} <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontWeight: 400 }}>/ 5</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      {[1, 2, 3, 4, 5].map(n => {
                        const cnt = q.distribution?.[n] || 0;
                        const pct = q.answerCount ? (cnt / q.answerCount) * 100 : 0;
                        return (
                          <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{cnt}</div>
                            <div style={{ width: '100%', background: 'var(--color-background)', borderRadius: 4, overflow: 'hidden', height: 60 }}>
                              <div style={{ width: '100%', height: `${pct}%`, background: 'var(--color-primary)', borderRadius: 4, marginTop: `${100 - pct}%` }} />
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{n}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {(q.questionType === 'MULTIPLE_CHOICE' || q.questionType === 'YES_NO') && q.tally && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(q.tally as Record<string, number>).sort(([, a], [, b]) => b - a).map(([opt, cnt]) => {
                      const pct = q.answerCount ? Math.round((cnt / q.answerCount) * 100) : 0;
                      return (
                        <div key={opt}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                            <span>{opt}</span>
                            <span style={{ fontWeight: 700 }}>{cnt} ({pct}%)</span>
                          </div>
                          <div style={{ height: 8, background: 'var(--color-background)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', borderRadius: 4 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.questionType === 'TEXT' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(q.textAnswers || []).length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No responses yet.</div>
                    ) : (q.textAnswers || []).map((t: string, i: number) => (
                      <div key={i} style={{ background: 'var(--color-background)', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
                        "{t}"
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create survey modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '93vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Create Survey</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><IconX size={18} /></button>
            </div>

            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Survey meta */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Title *</label>
                <input style={inputStyle} placeholder="e.g. Q2 Employee Satisfaction Survey" value={surveyForm.title} onChange={e => setSurveyForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Description</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={surveyForm.description} onChange={e => setSurveyForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Type</label>
                  <select style={inputStyle} value={surveyForm.type} onChange={e => setSurveyForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="NAMED">Named</option>
                    <option value="ANONYMOUS">Anonymous</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Target Role</label>
                  <select style={inputStyle} value={surveyForm.targetRole} onChange={e => setSurveyForm(f => ({ ...f, targetRole: e.target.value }))}>
                    <option value="">All</option>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="HR_ADMIN">HR Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Deadline</label>
                  <input type="date" style={inputStyle} value={surveyForm.deadline} onChange={e => setSurveyForm(f => ({ ...f, deadline: e.target.value }))} />
                </div>
              </div>

              {/* Questions */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 700 }}>Questions *</label>
                  <button onClick={() => setQuestions(p => [...p, emptyQuestion()])}
                    style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <IconPlus size={13} /> Add Question
                  </button>
                </div>
                {questions.map((q, i) => (
                  <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 14, marginBottom: 10, background: 'var(--color-background)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
                      <input style={inputStyle} placeholder={`Question ${i + 1}`} value={q.questionText} onChange={e => updateQuestion(i, 'questionText', e.target.value)} />
                      <select style={{ ...inputStyle, width: 160 }} value={q.questionType} onChange={e => updateQuestion(i, 'questionType', e.target.value)}>
                        {Q_TYPES.map(t => <option key={t} value={t}>{Q_LABELS[t]}</option>)}
                      </select>
                      {questions.length > 1 && (
                        <button onClick={() => setQuestions(p => p.filter((_, j) => j !== i))}
                          style={{ padding: '9px', borderRadius: 8, border: '1px solid #fecaca', background: 'none', cursor: 'pointer', color: '#dc2626' }}>
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>
                    {q.questionType === 'MULTIPLE_CHOICE' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {q.options.map((opt, oi) => (
                          <div key={oi} style={{ display: 'flex', gap: 6 }}>
                            <input style={inputStyle} placeholder={`Option ${oi + 1}`} value={opt} onChange={e => updateOption(i, oi, e.target.value)} />
                            {q.options.length > 2 && (
                              <button onClick={() => updateQuestion(i, 'options', q.options.filter((_, j) => j !== oi))}
                                style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                                <IconX size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => updateQuestion(i, 'options', [...q.options, ''])}
                          style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', paddingLeft: 0 }}>
                          + Add option
                        </button>
                      </div>
                    )}
                    {q.questionType === 'YES_NO' && (
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Respondents will choose Yes or No.</div>
                    )}
                    {q.questionType === 'RATING' && (
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Respondents will rate from 1 (lowest) to 5 (highest).</div>
                    )}
                  </div>
                ))}
              </div>

              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCreate(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => createMutation.mutate({ ...surveyForm, questions })} disabled={createMutation.isPending}
                  style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  {createMutation.isPending ? 'Creating...' : 'Create Survey'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
