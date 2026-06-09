import { useState, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import styles from "./CandidateLoginPage.module.css";
import { useAppDispatch, useAppSelector } from "@/store";
import { candidateLogin } from "@/store/slices/authSlice";
import { api } from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { IconUser, IconLock, IconEye, IconEyeOff } from "@/assets/icons";
import { Spinner } from "@/components/ui/Spinner";
import { Tooltip } from "@/components/ui/Tooltip";
import { LinkStatusScreen, LinkStatus } from "@/features/candidate/components/LinkStatusScreen";
import { UserRole } from "@/types";
import { isAssessmentDone } from "@/utils/assessmentSession";
import { ROUTES } from "@/constants/routes";
import logoUrl from "@/assets/favicon.svg";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

function LoadingScreen() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <Spinner size="lg" />
    </div>
  );
}

/**
 * Entry point for admin-scheduled candidates.
 * Validates the share link, then shows a restricted login form —
 * no Google OAuth, no self-registration — so only credentialed
 * candidates can access the assessment.
 */
export default function AssessmentAccessPage() {
  const { token } = useParams<{ token: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const isCandidate = isAuthenticated && user?.role === UserRole.CANDIDATE;

  const [checking, setChecking] = useState(true);
  const [linkStatus, setLinkStatus] = useState<LinkStatus | "valid" | null>(null);
  const [linkMessage, setLinkMessage] = useState("");
  const [linkStartTime, setLinkStartTime] = useState("");
  const [showPass, setShowPass] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!token) {
      setLinkStatus("invalid");
      setChecking(false);
      return;
    }
    api
      .get(`${API_ENDPOINTS.ASSESSMENTS.SHARE_VALIDATE}?link=${token}`)
      .then((res) => {
        const v = res.data.data;
        if (v.can_allow) {
          setLinkStatus("valid");
        } else {
          if (v.is_expirable) {
            setLinkStatus(v.is_expired ? "expired" : "not_started");
          } else {
            setLinkStatus("invalid");
          }
          setLinkMessage(v.message ?? "");
          if (v.start_time) setLinkStartTime(v.start_time);
        }
      })
      .catch(() => {
        // Network error — allow through rather than blocking the candidate
        setLinkStatus("valid");
      })
      .finally(() => setChecking(false));
  }, [token]);

  const onSubmit = async (values: FormData) => {
    try {
      await dispatch(candidateLogin(values)).unwrap();
      navigate(ROUTES.ASSESSMENT.instructions(token!), { replace: true });
    } catch (e: unknown) {
      setError("root", {
        message: (e as { message?: string })?.message ?? "Invalid credentials",
      });
    }
  };

  if (checking) return <LoadingScreen />;

  if (linkStatus !== "valid") {
    return (
      <LinkStatusScreen
        status={linkStatus as LinkStatus}
        message={linkMessage}
        startTime={linkStartTime}
      />
    );
  }

  // Already authenticated candidate — skip login and go straight to assessment
  if (isCandidate && token) {
    if (isAssessmentDone(token)) {
      return <Navigate to={ROUTES.ASSESSMENT.completed(token)} replace />;
    }
    return <Navigate to={ROUTES.ASSESSMENT.instructions(token)} replace />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Left: restricted login form */}
        <div className={styles.left}>
          <div className={styles.formWrap}>
            <div className={styles.brand}>
              <img src={logoUrl} width="44" height="44" alt="SoftSuave Hire" />
              <h1 className={styles.brandName}>SoftSuave Hire</h1>
              <span className={styles.portalPill}>Assessment Portal</span>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
              <div className={styles.field}>
                <span className={styles.fieldIcon}>
                  <IconUser size={18} />
                </span>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  {...register("email")}
                />
              </div>
              {errors.email && <p className={styles.error}>{errors.email.message}</p>}

              <div className={styles.field}>
                <span className={styles.fieldIcon}>
                  <IconLock size={18} />
                </span>
                <input
                  className={styles.input}
                  type={showPass ? "text" : "password"}
                  placeholder="Password"
                  autoComplete="current-password"
                  {...register("password")}
                />
                <Tooltip content={showPass ? "Hide password" : "Show password"}>
                  <button
                    type="button"
                    className={styles.fieldIconBtn}
                    onClick={() => setShowPass((p) => !p)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </Tooltip>
              </div>
              {errors.password && <p className={styles.error}>{errors.password.message}</p>}
              {errors.root && <p className={styles.error}>{errors.root.message}</p>}

              <button type="submit" className={styles.loginBtn} disabled={isSubmitting}>
                {isSubmitting ? "Signing in…" : "Start Assessment"}
              </button>
            </form>

            {/* Restricted flow — no Google, no self-registration */}
            <p
              style={{
                marginTop: 20,
                textAlign: "center",
                fontSize: 12,
                color: "#94a3b8",
                lineHeight: 1.5,
              }}
            >
              Use the email and password provided by your recruiter.
            </p>
          </div>
        </div>

        {/* Right: gradient hero panel (reused from CandidateLoginPage) */}
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
            <h2 className={styles.welcomeTitle}>Ready to Begin?</h2>
            <p className={styles.welcomeSub}>Sign in to start your assessment</p>
          </div>
        </div>
      </div>
    </div>
  );
}
