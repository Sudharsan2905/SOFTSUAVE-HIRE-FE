import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import styles from "./CandidateLoginPage.module.css";
import { useAppDispatch } from "@/store";
import { candidateLogin, setAuthData } from "@/store/slices/authSlice";
import { api, extractApiErrorMessage } from "@/utils/api";
import { IconUser, IconLock, IconEye, IconEyeOff } from "@/assets/icons";
import { Tooltip } from "@/components/ui/Tooltip";
import logoUrl from "@/assets/favicon.svg";
import toast from "react-hot-toast";
import { ROUTES } from "@/constants/routes";
import { API_ENDPOINTS } from "@/constants/api";
import { candidateLoginSchema, CandidateLoginForm } from "@/features/auth/constants";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
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
  } = useForm<CandidateLoginForm>({
    resolver: zodResolver(candidateLoginSchema),
  });

  const registerPath = shareLink
    ? `${ROUTES.CANDIDATE.REGISTER}?share=${shareLink}`
    : ROUTES.CANDIDATE.REGISTER;

  const goNext = () => {
    if (shareLink) navigate(ROUTES.ASSESSMENT.instructions(shareLink));
    else navigate(ROUTES.CANDIDATE.DASHBOARD);
  };

  const onSubmit = async (values: CandidateLoginForm) => {
    try {
      await dispatch(
        candidateLogin({ ...values, ...(shareLink ? { share_link: shareLink } : {}) })
      ).unwrap();
      goNext();
    } catch (e: unknown) {
      setError("root", { message: typeof e === "string" ? e : "Invalid credentials" });
    }
  };

  const handleGoogleLogin = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return;
    try {
      const { data } = await api.post(API_ENDPOINTS.AUTH.GOOGLE, {
        credential: credentialResponse.credential,
      });
      const result = data.data;
      if (result?.needs_registration) {
        navigate(registerPath, { state: { googleData: result.google_data } });
        return;
      }
      dispatch(setAuthData(result));
      goNext();
    } catch (err: unknown) {
      toast.error(extractApiErrorMessage(err, "Google login failed"));
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* Left side - Form */}
      <div className={styles.formSection}>
        <div className={styles.formWrapper}>
          <div className={styles.logo}>
            <img
              src={logoUrl}
              width="48"
              height="48"
              alt="Talentia"
              className={styles.logoIcon}
            />
            <h1 className={styles.appName}>Talentia</h1>
            <span className={styles.tagline}>Candidate Portal</span>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
            <div className={styles.formGroup}>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>
                  <IconUser size={18} />
                </span>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="Email or Username"
                  autoComplete="email"
                  {...register("email")}
                />
              </div>
              {errors.email && <p className={styles.error}>{errors.email.message}</p>}
            </div>

            <div className={styles.formGroup}>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>
                  <IconLock size={18} />
                </span>
                <input
                  className={`${styles.input} ${styles.inputPassword}`}
                  type={showPass ? "text" : "password"}
                  placeholder="Password"
                  autoComplete="current-password"
                  {...register("password")}
                />
                <Tooltip content={showPass ? "Hide password" : "Show password"}>
                  <button
                    type="button"
                    className={styles.togglePassword}
                    onClick={() => setShowPass((p) => !p)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </Tooltip>
              </div>
              {errors.password && <p className={styles.error}>{errors.password.message}</p>}
            </div>

            {errors.root && <p className={styles.error}>{errors.root.message}</p>}

            <button type="submit" className={styles.loginBtn} disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Login Now"}
            </button>
          </form>

          <p className={styles.divider}>
            <strong>Login</strong> with Others
          </p>

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
            <Link to={registerPath} className={styles.link}>
              Register here
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Image only */}
      <div className={styles.featuresSection}>
        <img
          src="/candidate/login.webp"
          alt="Candidate Login"
          className={styles.heroImage}
          onContextMenu={(e) => e.preventDefault()}
          draggable={false}
        />
        <div className={styles.imageCaption}>
          <p className={styles.captionTitle}>
            Welcome Back, <span className={styles.captionHighlight}>Candidate</span>
          </p>
          <span className={styles.captionAccent} />
          <p className={styles.captionSub}>
            Access your assessment portal securely and continue your hiring journey with confidence.
          </p>
        </div>
      </div>
    </div>
  );
}
