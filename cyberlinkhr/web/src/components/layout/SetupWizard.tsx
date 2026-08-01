import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { IconBuilding, IconUsers, IconCash, IconCheck, IconArrowRight } from '@tabler/icons-react';
import api from '@/lib/api';

const STEPS = [
  { icon: IconBuilding, title: 'Welcome to CyberlinkHR', desc: 'Your HRMS is ready. Let\'s complete a quick setup to get started.' },
  { icon: IconUsers, title: 'Create Your First Department', desc: 'Departments help organize your workforce by function or team.' },
  { icon: IconCash, title: 'Set Up Salary Structure', desc: 'Define how salaries are split into basic, HRA, and allowances.' },
  { icon: IconCheck, title: 'You\'re All Set!', desc: 'Start adding employees and managing your HR from one place.' },
];

function Step1() {
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7 }}>
        This wizard will guide you through the initial setup. You can always change these settings later from <strong>Settings</strong>.
      </p>
    </div>
  );
}

function Step2({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api.post('/departments', { name: name.trim() });
      setDone(true);
      onDone();
    } catch { /* continue */ }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {done ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontSize: 14 }}>
          <IconCheck size={16} /> Department "{name}" created
        </div>
      ) : (
        <>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Department Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Engineering, HR, Finance"
            style={{
              padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 14, color: 'var(--text-1)', background: 'var(--bg-surface)', outline: 'none',
            }}
          />
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            style={{
              padding: '9px 20px', background: 'var(--brand)', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (!name.trim() || loading) ? 0.6 : 1,
            }}
          >
            {loading ? 'Creating...' : 'Create Department'}
          </button>
        </>
      )}
    </div>
  );
}

function Step3({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      await api.post('/payroll/structures', {
        name: 'Default Structure',
        basicPct: 40,
        hraPct: 20,
        specialPct: 40,
      });
      setDone(true);
      onDone();
    } catch { /* continue */ }
    finally { setLoading(false); }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {done ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontSize: 14 }}>
          <IconCheck size={16} /> Default salary structure created (Basic 40%, HRA 20%, Special 40%)
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            We'll create a default structure: <strong>Basic 40%</strong>, <strong>HRA 20%</strong>, <strong>Special Allowance 40%</strong>. You can customize later.
          </p>
          <button
            onClick={handleCreate}
            disabled={loading}
            style={{
              padding: '9px 20px', background: 'var(--brand)', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {loading ? 'Creating...' : 'Create Default Structure'}
          </button>
        </>
      )}
    </div>
  );
}

export default function SetupWizard({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [stepDone, setStepDone] = useState<boolean[]>([true, false, false, true]);

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const canNext = step === 0 || step === 3 || stepDone[step];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 480, background: 'var(--bg-surface)', borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden',
        border: '1px solid var(--border)',
      }}>
        {/* Progress */}
        <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: '10px 0', textAlign: 'center',
              fontSize: 11, fontWeight: 600,
              color: i === step ? 'var(--brand)' : i < step ? '#16a34a' : 'var(--text-3)',
              borderBottom: i === step ? '2px solid var(--brand)' : '2px solid transparent',
            }}>
              {i < step ? <IconCheck size={14} style={{ display: 'inline' }} /> : `Step ${i + 1}`}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: 32 }}>
          {(() => {
            const S = STEPS[step];
            const Icon = S.icon;
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} style={{ color: 'var(--brand)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-1)' }}>{S.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{S.desc}</div>
                  </div>
                </div>
                {step === 0 && <Step1 />}
                {step === 1 && <Step2 onDone={() => setStepDone(d => { const n = [...d]; n[1] = true; return n; })} />}
                {step === 2 && <Step3 onDone={() => setStepDone(d => { const n = [...d]; n[2] = true; return n; })} />}
              </>
            );
          })()}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 32px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 13 }}>
            Skip setup
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              disabled={!canNext}
              style={{
                padding: '9px 20px', background: canNext ? 'var(--brand)' : 'var(--border)', color: canNext ? '#fff' : 'var(--text-3)',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: canNext ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              Next <IconArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={() => { onClose(); navigate('/employees/new'); }}
              style={{
                padding: '9px 20px', background: 'var(--brand)', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              Add First Employee <IconArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
