import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import styles from "./CandidateLoginPage.module.css";
import { useAppDispatch } from "@/store";
import { candidateLogin, googleLogin } from "@/store/slices/authSlice";
import { IconEye, IconEyeOff } from "@/assets/icons";
import logoUrl from "@/assets/favicon.svg";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

export default function CandidateLoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPass, setShowPass] = useState(false);
  const shareLink = searchParams.get("share");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const goNext = () => {
    if (shareLink) navigate(`/assessment/${shareLink}/instructions`);
    else navigate("/candidate/dashboard");
  };

  const onSubmit = async (values: FormData) => {
    try {
      await dispatch(candidateLogin(values)).unwrap();
      goNext();
    } catch (e: unknown) {
      setError("root", { message: (e as { message?: string })?.message || "Invalid credentials" });
    }
  };

  const handleGoogleLogin = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return;
    try {
      await dispatch(googleLogin(credentialResponse.credential)).unwrap();
      goNext();
    } catch {
      // error already shown via Redux toast
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Left: login form */}
        <div className={styles.left}>
          <div className={styles.formWrap}>
            <div className={styles.brand}>
              <img src={logoUrl} width="44" height="44" alt="SoftSuave Hire" />
              <h1 className={styles.brandName}>SoftSuave Hire</h1>
              <span className={styles.portalPill}>Candidate Portal</span>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
              <div className={styles.field}>
                <span className={styles.fieldIcon}>
                  <UserIcon />
                </span>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="Username"
                  {...register("email")}
                />
              </div>
              {errors.email && <p className={styles.error}>{errors.email.message}</p>}

              <div className={styles.field}>
                <span className={styles.fieldIcon}>
                  <LockIcon />
                </span>
                <input
                  className={styles.input}
                  type={showPass ? "text" : "password"}
                  placeholder="Password"
                  {...register("password")}
                />
                <button
                  type="button"
                  className={styles.fieldIconBtn}
                  onClick={() => setShowPass((p) => !p)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  title={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
              {errors.password && <p className={styles.error}>{errors.password.message}</p>}

              {errors.root && <p className={styles.error}>{errors.root.message}</p>}

              <button type="submit" className={styles.loginBtn} disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Login Now"}
              </button>
            </form>

            <p className={styles.others}>
              <strong>Login</strong> with Others
            </p>

            {/* Custom-styled Google button with the real widget overlaid transparently */}
            <div className={styles.socialWrap}>
              <button type="button" className={styles.socialBtn} tabIndex={-1}>
                <GoogleIcon />
                <span>
                  Login with <strong>google</strong>
                </span>
              </button>
              <div className={styles.googleOverlay}>
                <GoogleLogin
                  onSuccess={handleGoogleLogin}
                  onError={() => undefined}
                  width="320"
                  text="continue_with"
                  shape="rectangular"
                />
              </div>
            </div>

            <p className={styles.footer}>
              Don't have an account?{" "}
              <Link
                to={shareLink ? `/candidate/register?share=${shareLink}` : "/candidate/register"}
                className={styles.link}
              >
                Register here
              </Link>
            </p>
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
