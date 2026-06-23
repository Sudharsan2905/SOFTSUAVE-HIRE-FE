import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import styles from "./AdminLoginPage.module.css";
import { useAppDispatch, useAppSelector } from "@/store";
import { adminLogin } from "@/store/slices/authSlice";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { IconMail, IconLock, IconEye, IconEyeOff } from "@/assets/icons";
import logoUrl from "@/assets/favicon.svg";
import { UserRole } from "@/constants/enums";
import { ROUTES } from "@/constants/routes";
import { adminLoginSchema, AdminLoginForm } from "@/features/auth/constants";

export default function AdminLoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAppSelector((s) => s.auth);
  const [showPass, setShowPass] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginForm>({
    resolver: zodResolver(adminLoginSchema),
  });

  useEffect(() => {
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
    if (isAuthenticated && isAdmin) navigate(ROUTES.ADMIN.QUESTION_BANK, { replace: true });
  }, [isAuthenticated, navigate, user]);

  const onSubmit = (data: AdminLoginForm) => {
    dispatch(adminLogin(data));
  };

  return (
    <div className={styles.pageContainer}>
      {/* Left side - Form */}
      <div className={styles.formSection}>
        <div className={styles.formWrapper}>
          <div className={styles.logo}>
            <img src={logoUrl} width="48" height="48" alt="SoftSuave Hire" className={styles.logoIcon} />
            <h1 className={styles.appName}>SoftSuave Hire</h1>
            <span className={styles.tagline}>Administrator Portal</span>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="admin-email" className={styles.label}>Email Address</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}><IconMail size={18} /></span>
                <input
                  id="admin-email"
                  className={styles.input}
                  type="email"
                  placeholder="Enter email"
                  autoComplete="email"
                  {...register("email")}
                />
              </div>
              {errors.email && <p className={styles.error}>{errors.email.message}</p>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="admin-password" className={styles.label}>Password</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}><IconLock size={18} /></span>
                <input
                  id="admin-password"
                  className={`${styles.input} ${styles.inputPassword}`}
                  type={showPass ? "text" : "password"}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  {...register("password")}
                />
                <Tooltip content={showPass ? "Hide password" : "Show password"}>
                  <button
                    type="button"
                    className={styles.togglePassword}
                    onClick={() => setShowPass(!showPass)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </Tooltip>
              </div>
              {errors.password && <p className={styles.error}>{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              fullWidth
              isLoading={isLoading}
              size="lg"
              className={styles.submitBtn}
            >
              Sign In
            </Button>
          </form>

          <p className={styles.footer}>© SoftSuave Hire {new Date().getFullYear()}</p>
        </div>
      </div>

      {/* Right side - Features */}
      <div className={styles.featuresSection}>
        <div className={styles.decorativeCircleTop} />
        <div className={styles.decorativeCircleBottom} />

        <div className={styles.featuresContent}>
          <div className={styles.featureCards}>
            <div className={styles.featureCard}>
              <div className={styles.cardImage}>
                <img src="/admin-login/card-ai-essay.webp" alt="AI Essay Grading" />
              </div>
              <h3>AI Essay Grading</h3>
              <p>Leverage AI to grade essays and generate insights.</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.cardImage}>
                <img src="/admin-login/card-analytics.webp" alt="Candidate Data Analyst" />
              </div>
              <h3>Candidate Data Analyst</h3>
              <p>Analyze candidate data and performance metrics.</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.cardImage}>
                <img src="/admin-login/card-monitoring.webp" alt="Live Monitoring" />
              </div>
              <h3>Live Monitoring</h3>
              <p>Monitor assessments in real-time with live screen tracking.</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.cardImage}>
                <img src="/admin-login/card-admin.webp" alt="Administrator" />
              </div>
              <h3>Administrator</h3>
              <p>Manage users, settings, and system configurations.</p>
            </div>
          </div>

          <div className={styles.welcomeSection}>
            <h2 className={styles.welcomeTitle}>Welcome Admin!</h2>
            <p className={styles.welcomeSub}>
              Manage exams, review candidate assessments, and leverage AI-powered essay evaluation to make data-driven hiring decisions.
            </p>
            <div className={styles.actionButtons}>
              <button className={styles.btnSecondary}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                AI Grading
              </button>
              <button className={`${styles.btnSecondary} ${styles.btnSecondaryDelayed}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="2" x2="12" y2="22" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                Analytics
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
