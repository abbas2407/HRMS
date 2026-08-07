import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';

const emptyToUndefined = (val: any) => (val === '' ? undefined : val);

const step1 = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Valid email required'),
  phone: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^(?:(?:\+91|91|0)?[6-9]\d{9}|\+?[1-9]\d{9,14})$/, 'Invalid phone number format. Must be a valid Indian (+91) or international number.').optional()
  ),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dob: z.string().min(1, 'Required'),
});
const step2 = z.object({
  joiningDate: z.string().min(1, 'Required'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).default('FULL_TIME'),
  departmentId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
  workLocation: z.string().optional(),
  grade: z.string().optional(),
});
const step3 = z.object({
  grossSalary: z.coerce.number().positive().optional(),
  uanNumber: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^\d{12}$/, 'UAN must be exactly 12 digits').optional()
  ),
  esicIpNumber: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^\d{17}$/, 'ESIC IP Number must be exactly 17 digits').optional()
  ),
  panNumber: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/, 'Invalid PAN format. Must be 10 characters (e.g., ABCDE1234F).').optional()
  ),
  bankAccount: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^\d{9,18}$/, 'Bank account must be between 9 and 18 digits.').optional()
  ),
  bankIfsc: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, 'Invalid IFSC format. Must be 11 characters (e.g., SBIN0001234).').optional()
  ),
  bankName: z.string().optional(),
});

const fullSchema = step1.merge(step2).merge(step3);
type FullForm = z.infer<typeof fullSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEPS = ['Personal', 'Employment', 'Payroll / Statutory'];

export default function AddEmployeeModal({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const qc = useQueryClient();

  const schemas = [step1, step2, step3];

  const { register, handleSubmit, trigger, formState: { errors }, reset } = useForm<FullForm>({
    resolver: zodResolver(fullSchema),
  });

  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data.data),
    enabled: open,
  });

  const { data: desigs } = useQuery({
    queryKey: ['designations'],
    queryFn: () => api.get('/designations').then(r => r.data.data),
    enabled: open,
  });

  const { data: officeLocations } = useQuery({
    queryKey: ['office-locations'],
    queryFn: () => api.get('/office-locations').then(r => r.data.data),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (d: FullForm) => api.post('/employees', { ...d, grossSalary: d.grossSalary || undefined }),
    onSuccess: (res) => {
      toast.success(`Employee created — ${res.data.data.employeeCode}`);
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employee-stats'] });
      handleClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to create employee'),
  });

  function handleClose() {
    setStep(0);
    reset();
    onClose();
  }

  async function nextStep() {
    const fields = step === 0
      ? ['firstName', 'lastName', 'email', 'phone', 'gender', 'dob']
      : ['joiningDate', 'employmentType', 'departmentId', 'designationId'];
    const ok = await trigger(fields as any);
    if (ok) setStep(s => s + 1);
  }

  const fieldError = (field: keyof FullForm) => (errors as any)[field]?.message as string | undefined;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add Employee"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Button onClick={step === 0 ? handleClose : () => setStep(s => s - 1)}>
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            {STEPS.map((s, i) => (
              <span key={s} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: i === step ? 'var(--brand)' : i < step ? 'var(--success)' : 'var(--border)',
                display: 'inline-block',
              }} />
            ))}
          </div>
          {step < 2
            ? <Button variant="primary" onClick={nextStep}>Next →</Button>
            : <Button variant="primary" loading={mutation.isPending} onClick={handleSubmit(d => mutation.mutate(d))}>Create Employee</Button>
          }
        </div>
      }
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Step {step + 1} of {STEPS.length}</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{STEPS[step]}</div>
      </div>

      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="First Name" required error={fieldError('firstName')} {...register('firstName')} />
            <Input label="Last Name" required error={fieldError('lastName')} {...register('lastName')} />
          </div>
          <Input label="Work Email" type="email" required error={fieldError('email')} {...register('email')} />
          <Input label="Phone" error={fieldError('phone')} {...register('phone')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Select label="Gender" options={[{ value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }, { value: 'OTHER', label: 'Other' }]} placeholder="Select" {...register('gender')} />
            <Input label="Date of Birth" type="date" required error={fieldError('dob')} {...register('dob')} />
          </div>
          <div style={{ background: 'var(--brand-l)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--brand)' }}>
            A login will be created with password <strong>Welcome@123</strong>
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Joining Date" type="date" required error={fieldError('joiningDate')} {...register('joiningDate')} />
            <Select
              label="Employment Type" required
              options={[
                { value: 'FULL_TIME', label: 'Full Time' },
                { value: 'PART_TIME', label: 'Part Time' },
                { value: 'CONTRACT', label: 'Contract' },
                { value: 'INTERN', label: 'Intern' },
              ]}
              {...register('employmentType')}
            />
          </div>
          <Select
            label="Department"
            options={(depts || []).map((d: any) => ({ value: d.id, label: d.name }))}
            placeholder="Select department"
            {...register('departmentId')}
          />
          <Select
            label="Designation"
            options={(desigs || []).map((d: any) => ({ value: d.id, label: d.name }))}
            placeholder="Select designation"
            {...register('designationId')}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Select
              label="Work Location"
              options={(officeLocations || []).map((loc: any) => ({ value: loc.name, label: loc.name }))}
              placeholder="Select location"
              {...register('workLocation')}
            />
            <Input label="Grade" {...register('grade')} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Gross Salary (₹/month)" type="number" placeholder="e.g. 50000" error={fieldError('grossSalary')} {...register('grossSalary')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="UAN Number" placeholder="12-digit UAN" error={fieldError('uanNumber')} {...register('uanNumber')} />
            <Input label="ESIC IP Number" error={fieldError('esicIpNumber')} {...register('esicIpNumber')} />
          </div>
          <Input label="PAN Number" placeholder="ABCDE1234F (will be encrypted)" error={fieldError('panNumber')} {...register('panNumber')} />
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div className="form-label" style={{ marginBottom: 8 }}>Bank Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Input label="Account Number (encrypted)" error={fieldError('bankAccount')} {...register('bankAccount')} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="IFSC Code" placeholder="HDFC0001234" error={fieldError('bankIfsc')} {...register('bankIfsc')} />
                <Input label="Bank Name" placeholder="HDFC Bank" error={fieldError('bankName')} {...register('bankName')} />
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 11.5, color: 'var(--text-3)' }}>
            All statutory data (PAN, Aadhaar, bank account) is encrypted with AES-256-GCM at rest.
          </div>
        </div>
      )}
    </Modal>
  );
}
