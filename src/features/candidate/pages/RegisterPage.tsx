import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import styles from "./RegisterPage.module.css";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAppDispatch } from "@/store";
import { candidateRegister } from "@/store/slices/authSlice";
import { IconEye, IconEyeOff } from "@/assets/icons";
import logoUrl from "@/assets/favicon.svg";
import { ROUTES } from "@/constants/routes";
import { GENDER_OPTIONS } from "@/constants/app";
import { candidateRegisterSchema, CandidateRegisterForm } from "@/features/auth/constants";
import type { GooglePrefillData } from "@/features/candidate/types";

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const shareLink = searchParams.get("share");

  const googleData: GooglePrefillData | null =
    (location.state as { googleData?: GooglePrefillData })?.googleData ?? null;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CandidateRegisterForm>({
    resolver: zodResolver(candidateRegisterSchema),
    defaultValues: {
      first_name: googleData?.first_name ?? "",
      last_name: googleData?.last_name ?? "",
      email: googleData?.email ?? "",
    },
  });

  const passwordValue = watch("password", "");
  const passwordRules = [
    { label: "At least 8 characters", met: passwordValue.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(passwordValue) },
    { label: "One lowercase letter", met: /[a-z]/.test(passwordValue) },
    { label: "One number", met: /\d/.test(passwordValue) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(passwordValue) },
  ];

  useEffect(() => {
    if (googleData) {
      setValue("first_name", googleData.first_name || "");
      setValue("last_name", googleData.last_name || "");
      setValue("email", googleData.email || "");
    }
  }, [googleData, setValue]);

  const onSubmit = async (values: CandidateRegisterForm) => {
    const { confirm_password: _c, ...payload } = values;
    const finalPayload: Record<string, unknown> = { ...payload };
    if (googleData?.google_id) {
      finalPayload.google_id = googleData.google_id;
    }
    try {
      await dispatch(candidateRegister(finalPayload)).unwrap();
      if (shareLink) navigate(`${ROUTES.CANDIDATE.LOGIN}?share=${shareLink}`);
      else navigate(ROUTES.CANDIDATE.DASHBOARD);
    } catch (e: unknown) {
      setError("root", { message: typeof e === "string" ? e : "Registration failed" });
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* Left side - Scrollable form */}
      <div className={styles.formSection}>
        <div className={styles.formWrapper}>
          <div className={styles.logo}>
            <img src={logoUrl} width="48" height="48" alt="SoftSuave Hire" className={styles.logoIcon} />
            <h1 className={styles.appName}>SoftSuave Hire</h1>
            <span className={styles.tagline}>Create Account</span>
          </div>

          {googleData && (
            <div className={styles.googleBanner}>
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
              <span>Continuing with Google — please complete your profile below</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
            <div className={styles.row}>
              <Input
                label="First Name *"
                placeholder="John"
                autoComplete="given-name"
                error={errors.first_name?.message}
                readOnly={!!googleData?.first_name}
                {...register("first_name")}
              />
              <Input
                label="Last Name"
                placeholder="Doe (optional)"
                autoComplete="family-name"
                error={errors.last_name?.message}
                readOnly={!!googleData?.last_name}
                {...register("last_name")}
              />
            </div>
            <Input
              label="Email *"
              type="email"
              placeholder="john@email.com"
              autoComplete="email"
              error={errors.email?.message}
              readOnly={!!googleData?.email}
              {...register("email")}
            />
            <Input
              label="Phone *"
              placeholder="+91 9876543210"
              autoComplete="tel"
              error={errors.phone?.message}
              {...register("phone")}
            />
            <div className={styles.row}>
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Gender *"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select gender"
                    options={GENDER_OPTIONS}
                    error={errors.gender?.message}
                    dropdownClassName={styles.selectMenu}
                  />
                )}
              />
              <Controller
                name="dob"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    label="Date of Birth"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    error={errors.dob?.message}
                    placeholder="Select date of birth"
                    dropdownClassName={styles.selectMenu}
                  />
                )}
              />
            </div>
            <div className={styles.row}>
              <Input
                label="College / Institution"
                placeholder="University name (optional)"
                autoComplete="organization"
                error={errors.college_name?.message}
                {...register("college_name")}
              />
              <Input
                label="City"
                placeholder="City (optional)"
                autoComplete="address-level2"
                error={errors.college_city?.message}
                {...register("college_city")}
              />
            </div>
            <Input
              label="Password *"
              type={showPass ? "text" : "password"}
              placeholder="Min 8 characters"
              autoComplete="new-password"
              error={errors.password?.message}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9a9aae",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              }
              {...register("password")}
            />
            {passwordValue.length > 0 && (
              <div className={styles.strengthList}>
                {passwordRules.map((rule) => (
                  <div key={rule.label} className={`${styles.strengthItem} ${rule.met ? styles.strengthMet : styles.strengthUnmet}`}>
                    <span className={styles.strengthIcon}>{rule.met ? "✓" : "✗"}</span>
                    {rule.label}
                  </div>
                ))}
              </div>
            )}
            <Input
              label="Confirm Password *"
              type={showConfirm ? "text" : "password"}
              placeholder="Repeat password"
              autoComplete="new-password"
              error={errors.confirm_password?.message}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9a9aae",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {showConfirm ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              }
              {...register("confirm_password")}
            />
            {errors.root && <p className={styles.error}>{errors.root.message}</p>}
            <Button type="submit" fullWidth isLoading={isSubmitting} className={styles.submitBtn}>
              Create Account
            </Button>
          </form>

          <p className={styles.footer}>
            Already have an account?{" "}
            <Link
              to={shareLink ? `${ROUTES.CANDIDATE.LOGIN}?share=${shareLink}` : ROUTES.CANDIDATE.LOGIN}
              className={styles.link}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Image only */}
      <div className={styles.featuresSection}>
        <img
          src="/candidate/register.png"
          alt="Candidate Register"
          className={styles.heroImage}
          onContextMenu={(e) => e.preventDefault()}
          draggable={false}
        />
        <div className={styles.imageCaption}>
          <p className={styles.captionTitle}>
            Your Journey to <span className={styles.captionHighlight}>Success Starts Here</span>
          </p>
          <span className={styles.captionAccent} />
          <p className={styles.captionSub}>
            We ensure a secure, fair and seamless assessment experience for every candidate.
          </p>
        </div>
      </div>
    </div>
  );
}
