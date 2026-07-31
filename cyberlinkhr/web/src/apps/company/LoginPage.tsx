import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';

const schema = z.object({
  slug: z.string().min(1, 'Company ID required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      const { accessToken, refreshToken, user, tenant } = res.data.data;
      setAuth(user, tenant, accessToken, refreshToken);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, background: 'var(--brand)', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <span style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>C</span>
          </div>
          <h1 style={{ marginBottom: 4 }}>CyberlinkHR</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Sign in to your account</p>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Company ID"
              placeholder="your-company"
              error={errors.slug?.message}
              required
              {...register('slug')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="admin@company.com"
              error={errors.email?.message}
              required
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              required
              {...register('password')}
            />
            <Button type="submit" variant="primary" loading={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
              Sign in
            </Button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--text-3)', fontSize: 12 }}>
          Powered by Cyberlink Technologies
        </p>
      </div>
    </div>
  );
}
