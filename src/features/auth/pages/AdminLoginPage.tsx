import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import styles from "./AdminLoginPage.module.css";
import { useAppDispatch, useAppSelector } from "@/store";
import { adminLogin } from "@/store/slices/authSlice";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconCalendar,
  IconUsers,
  IconUser,
} from "@/assets/icons";
import logoUrl from "@/assets/favicon.svg";
import { UserRole } from "@/constants/enums";
import { ROUTES } from "@/constants/routes";
import { adminLoginSchema, AdminLoginForm } from "@/features/auth/constants";

const FEATURES = [
  {
    title: "Schedule Interviews",
    text: "Create and manage interview sessions.",
    tone: styles.toneBlue,
    icon: <IconCalendar size={26} />,
  },
  {
    title: "Conduct Interviews",
    text: "Run online interviews with screen and recording support.",
    tone: styles.toneGreen,
    icon: <IconUsers size={26} />,
  },
  {
    title: "Evaluate Candidates",
    text: "Assess submissions and add interview feedback.",
    tone: styles.toneAmber,
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="4" y="11" width="4" height="9" rx="1" />
        <rect x="10" y="4" width="4" height="16" rx="1" />
        <rect x="16" y="8" width="4" height="12" rx="1" />
      </svg>
    ),
  },
  {
    title: "Manage Pipeline",
    text: "Track candidates across interview stages.",
    tone: styles.tonePurple,
    icon: (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3 3 8l9 5 9-5-9-5z" />
        <path d="m3 13 9 5 9-5" />
        <path d="m3 17.5 9 5 9-5" opacity="0.5" />
      </svg>
    ),
  },
];

function HeroIllustration() {
  return (
    <svg
      className={styles.illustration}
      viewBox="0 0 420 300"
      role="img"
      aria-label="Online interview illustration"
    >
      <rect x="250" y="20" width="110" height="170" rx="26" fill="#b9aef0" />
      <ellipse cx="290" cy="270" rx="150" ry="10" fill="#dcd6f7" opacity="0.7" />
      <g transform="translate(20 130)">
        <path
          d="M40 120c-20-30-30-60-5-85 8 25 16 45 5 85zM40 120c25-25 45-50 40-80-22 22-36 48-40 80z"
          fill="#38b886"
        />
        <path d="M40 120c-5-35 5-60 25-75-5 30-10 55-25 75z" fill="#6fd3a6" />
        <path d="M10 118h60l-8 50H18z" fill="#b9aef0" />
      </g>
      <rect x="85" y="55" width="260" height="170" rx="12" fill="#2b3563" />
      <rect x="97" y="67" width="236" height="146" rx="6" fill="#eef0fb" />
      <rect x="107" y="80" width="130" height="120" rx="6" fill="#8e86d6" />
      <circle cx="172" cy="123" r="20" fill="#f2f0ff" />
      <path d="M132 190c4-26 20-38 40-38s36 12 40 38z" fill="#f2f0ff" />
      <circle cx="250" cy="85" r="5" fill="#ef4444" />
      <text x="260" y="89" fontSize="9" fill="#555" fontWeight="600">
        REC
      </text>
      {[110, 130, 150].map((y) => (
        <g key={y}>
          <circle cx="257" cy={y} r="5" fill="#8e86d6" />
          <rect x="268" y={y - 3} width="52" height="6" rx="3" fill="#8e86d6" />
        </g>
      ))}
      <path d="M60 225h310l-14 18H74z" fill="#3a4478" />
      <rect x="340" y="190" width="40" height="52" rx="8" fill="#fff" stroke="#e5e2f5" />
    </svg>
  );
}

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
      {/* Left - Hero */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <div className={styles.heroTop}>
            <div className={styles.heroText}>
              <h2 className={styles.heroTitle}>Interview Management for Hiring Teams</h2>
              <p className={styles.heroSub}>
                Conduct, evaluate, and manage candidate interviews with a unified internal platform.
              </p>
            </div>
            <HeroIllustration />
          </div>

          <div className={styles.featureGrid}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <div className={`${styles.featureIcon} ${f.tone}`}>{f.icon}</div>
                <div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Right - Form */}
      <section className={styles.formSection}>
        <div className={styles.formWrapper}>
          <div className={styles.logo}>
            <div className={styles.brand}>
              <img
                src={logoUrl}
                width="48"
                height="48"
                alt="Talentia"
                className={styles.logoIcon}
              />
              <span className={styles.appName}>Talentia</span>
            </div>
            <span className={styles.tagline}>
              <IconUser size={16} /> Interview Platform (Internal)
            </span>
          </div>

          <div className={styles.heading}>
            <h1>Sign In</h1>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="admin-email" className={styles.label}>
                Email Address
              </label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>
                  <IconMail size={20} />
                </span>
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
              <label htmlFor="admin-password" className={styles.label}>
                Password
              </label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>
                  <IconLock size={20} />
                </span>
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
                    {showPass ? <IconEyeOff size={20} /> : <IconEye size={20} />}
                  </button>
                </Tooltip>
              </div>
              {errors.password && <p className={styles.error}>{errors.password.message}</p>}
            </div>

            <div className={styles.options}>
              <label className={styles.remember}>
                <input type="checkbox" defaultChecked /> Remember me
              </label>
              <button
                type="button"
                className={styles.forgot}
                onClick={() => toast("Please contact your super admin to reset your password.")}
              >
                Forgot password?
              </button>
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

          <p className={styles.footer}>© Talentia · Internal Use Only</p>
        </div>
      </section>
    </div>
  );
}
