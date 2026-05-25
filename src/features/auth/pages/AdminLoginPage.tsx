import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import styles from './AdminLoginPage.module.css';
import { useAppDispatch, useAppSelector } from '@/store';
import { adminLogin } from '@/store/slices/authSlice';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IconMail, IconLock, IconEye, IconEyeOff } from '@/assets/icons';
import { useState } from 'react';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAppSelector((s) => s.auth);
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const onSubmit = (data: FormData) => {
    dispatch(adminLogin(data));
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="#2563EB" />
              <path d="M10 18h16M18 10l8 8-8 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className={styles.appName}>SoftSuave Hire</h1>
          <p className={styles.tagline}>Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <Input
            label="Email Address"
            type="email"
            placeholder="admin@softsuave.com"
            leftElement={<IconMail size={15} />}
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Password"
            type={showPass ? 'text' : 'password'}
            placeholder="Enter password"
            leftElement={<IconLock size={15} />}
            rightElement={
              <button type="button" onClick={() => setShowPass(!showPass)} style={{ cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
                {showPass ? <IconEyeOff size={15} /> : <IconEye size={15} />}
              </button>
            }
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" fullWidth isLoading={isLoading} size="lg">
            Sign In
          </Button>
        </form>

        <p className={styles.footer}>
          SoftSuave Hire &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
