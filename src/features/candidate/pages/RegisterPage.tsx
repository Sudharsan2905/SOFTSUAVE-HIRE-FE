import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import styles from './RegisterPage.module.css';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAppDispatch } from '@/store';
import { candidateRegister } from '@/store/slices/authSlice';
import { IconEye, IconEyeOff } from '@/assets/icons';

const passwordSchema = z
  .string()
  .min(8, 'Min 8 characters')
  .regex(/[A-Z]/, 'Must include an uppercase letter')
  .regex(/[a-z]/, 'Must include a lowercase letter')
  .regex(/[0-9]/, 'Must include a digit')
  .regex(/[^A-Za-z0-9]/, 'Must include a special character');

const schema = z
  .object({
    first_name: z.string().min(2, 'First name must be at least 2 characters'),
    last_name: z.string().optional(),
    email: z.string().email('Invalid email'),
    phone: z.string().min(10, 'Enter a valid phone number'),
    father_name: z.string().min(2, 'Father name required'),
    gender: z.enum(['male', 'female', 'other'], { required_error: 'Select a gender' }),
    dob: z.string().optional(),
    college_name: z.string().optional(),
    college_city: z.string().optional(),
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const shareLink = searchParams.get('share');

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormData) => {
    const { confirm_password, ...payload } = values;
    try {
      await dispatch(candidateRegister(payload)).unwrap();
      if (shareLink) navigate(`/assessment/${shareLink}/instructions`);
      else navigate('/candidate/dashboard');
    } catch (e: unknown) {
      setError('root', { message: (e as { message?: string })?.message || 'Registration failed' });
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>S</span>
          <span className={styles.logoText}>SoftSuave Hire</span>
        </div>
        <h1 className={styles.title}>Create Account</h1>
        <p className={styles.subtitle}>Register to start your assessment</p>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.row}>
            <Input label="First Name *" placeholder="John" error={errors.first_name?.message} {...register('first_name')} />
            <Input label="Last Name" placeholder="Doe (optional)" error={errors.last_name?.message} {...register('last_name')} />
          </div>
          <Input label="Email *" type="email" placeholder="john@email.com" error={errors.email?.message} {...register('email')} />
          <div className={styles.row}>
            <Input label="Phone *" placeholder="+91 9876543210" error={errors.phone?.message} {...register('phone')} />
            <Input label="Father's Name *" placeholder="Robert Doe" error={errors.father_name?.message} {...register('father_name')} />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Gender *</label>
              <select className={`${styles.select} ${errors.gender ? styles.selectError : ''}`} {...register('gender')}>
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              {errors.gender && <p className={styles.fieldError}>{errors.gender.message}</p>}
            </div>
            <Input label="Date of Birth" type="date" error={errors.dob?.message} {...register('dob')} />
          </div>
          <div className={styles.row}>
            <Input label="College / Institution" placeholder="University name (optional)" error={errors.college_name?.message} {...register('college_name')} />
            <Input label="College City" placeholder="City (optional)" error={errors.college_city?.message} {...register('college_city')} />
          </div>
          <div className={styles.row}>
            <Input
              label="Password *"
              type={showPass ? 'text' : 'password'}
              placeholder="Min 8 characters"
              error={errors.password?.message}
              rightElement={
                <button type="button" onClick={() => setShowPass((p) => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                  {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              }
              {...register('password')}
            />
            <Input
              label="Confirm Password *"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Repeat password"
              error={errors.confirm_password?.message}
              rightElement={
                <button type="button" onClick={() => setShowConfirm((p) => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                  {showConfirm ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              }
              {...register('confirm_password')}
            />
          </div>
          {errors.root && <p className={styles.error}>{errors.root.message}</p>}
          <Button type="submit" fullWidth isLoading={isSubmitting}>Create Account</Button>
        </form>

        <p className={styles.footer}>
          Already have an account?{' '}
          <Link to={shareLink ? `/candidate/login?share=${shareLink}` : '/candidate/login'} className={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
