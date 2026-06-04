import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import styles from "./AdminLoginPage.module.css";
import { useAppDispatch, useAppSelector } from "@/store";
import { adminLogin } from "@/store/slices/authSlice";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { IconMail, IconLock, IconEye, IconEyeOff } from "@/assets/icons";
import logoUrl from "@/assets/favicon.svg";
import { UserRole } from "@/types";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAppSelector((s) => s.auth);
  const [showPass, setShowPass] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
    if (isAuthenticated && isAdmin) navigate("/question-bank", { replace: true });
  }, [isAuthenticated, navigate]);

  const onSubmit = (data: FormData) => {
    dispatch(adminLogin(data));
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Left: login form */}
        <div className={styles.left}>
          <div className={styles.formWrap}>
            <div className={styles.logoArea}>
              <div className={styles.logoIcon}>
                <img src={logoUrl} width="48" height="48" alt="SoftSuave Hire" />
              </div>
              <h1 className={styles.appName}>SoftSuave Hire</h1>
              <p className={styles.tagline}>Administrator Portal</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
              <div className={styles.field}>
                <span className={styles.fieldIcon}>
                  <IconMail size={15} />
                </span>
                <input
                  className={styles.fieldInput}
                  type="email"
                  placeholder="Enter email"
                  autoComplete="email"
                  {...register("email")}
                />
              </div>
              {errors.email && <p className={styles.error}>{errors.email.message}</p>}

              <div className={styles.field}>
                <span className={styles.fieldIcon}>
                  <IconLock size={15} />
                </span>
                <input
                  className={styles.fieldInput}
                  type={showPass ? "text" : "password"}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  {...register("password")}
                />
                <Tooltip content={showPass ? "Hide password" : "Show password"}>
                  <button
                    type="button"
                    className={styles.fieldIconBtn}
                    onClick={() => setShowPass(!showPass)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                  </button>
                </Tooltip>
              </div>
              {errors.password && <p className={styles.error}>{errors.password.message}</p>}

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

            <p className={styles.footer}>SoftSuave Hire &copy; {new Date().getFullYear()}</p>
          </div>
        </div>

        {/* Right: gradient hero panel */}
        <div className={styles.right}>
          <div className={styles.badge} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#FBBF24">
              <path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z" />
            </svg>
          </div>
          <div className={styles.heroCard}>
            <img src="/person.svg" alt="" className={styles.heroImg} />
          </div>
          <div className={styles.welcome}>
            <h2 className={styles.welcomeTitle}>Welcome Back!</h2>
            <p className={styles.welcomeSub}>Please sign in to your account</p>
          </div>
        </div>
      </div>
    </div>
  );
}
