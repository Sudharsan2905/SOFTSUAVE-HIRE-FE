import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import styles from './CandidateLoginPage.module.css';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAppDispatch } from '@/store';
import { candidateLogin } from '@/store/slices/authSlice';
import { IconEye, IconEyeOff } from '@/assets/icons';
import logoUrl from '@/assets/favicon.svg';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export default function CandidateLoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPass, setShowPass] = useState(false);
  const shareLink = searchParams.get('share');

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormData) => {
    try {
      await dispatch(candidateLogin(values)).unwrap();
      if (shareLink) navigate(`/assessment/${shareLink}/instructions`);
      else navigate('/candidate/dashboard');
    } catch (e: unknown) {
      setError('root', { message: (e as { message?: string })?.message || 'Invalid credentials' });
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <img src={logoUrl} width="36" height="36" alt="SoftSuave Hire" />
          <span className={styles.logoText}>SoftSuave Hire</span>
        </div>
        <h1 className={styles.title}>Candidate Sign In</h1>
        <p className={styles.subtitle}>Sign in to access your assessment</p>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <Input
            label="Email"
            type="email"
            placeholder="your@email.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Password"
            type={showPass ? 'text' : 'password'}
            placeholder="Enter your password"
            error={errors.password?.message}
            rightElement={
              <button type="button" onClick={() => setShowPass((p) => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            }
            {...register('password')}
          />
          {errors.root && <p className={styles.error}>{errors.root.message}</p>}
          <Button type="submit" fullWidth isLoading={isSubmitting}>Sign In</Button>
        </form>

        <p className={styles.footer}>
          Don't have an account?{' '}
          <Link to={shareLink ? `/candidate/register?share=${shareLink}` : '/candidate/register'} className={styles.link}>
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
