import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import styles from "./RegisterPage.module.css";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAppDispatch } from "@/store";
import { candidateRegister } from "@/store/slices/authSlice";
import { IconEye, IconEyeOff } from "@/assets/icons";
import logoUrl from "@/assets/favicon.svg";

interface GooglePrefillData {
  email: string;
  first_name: string;
  last_name: string;
  google_id: string;
  picture: string;
}

const passwordSchema = z
  .string()
  .min(8, "Min 8 characters")
  .regex(/[A-Z]/, "Must include an uppercase letter")
  .regex(/[a-z]/, "Must include a lowercase letter")
  .regex(/\d/, "Must include a digit")
  .regex(/[^A-Za-z0-9]/, "Must include a special character");

const schema = z
  .object({
    first_name: z.string().min(2, "First name must be at least 2 characters"),
    last_name: z.string().optional(),
    email: z.string().email("Invalid email"),
    phone: z.string().min(10, "Enter a valid phone number"),
    gender: z.enum(["male", "female", "other"], { required_error: "Select a gender" }),
    dob: z.string().optional(),
    college_name: z.string().optional(),
    college_city: z.string().optional(),
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof schema>;

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
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: googleData?.first_name || "",
      last_name: googleData?.last_name || "",
      email: googleData?.email || "",
    },
  });

  useEffect(() => {
    if (googleData) {
      setValue("first_name", googleData.first_name || "");
      setValue("last_name", googleData.last_name || "");
      setValue("email", googleData.email || "");
    }
  }, [googleData, setValue]);

  const onSubmit = async (values: FormData) => {
    const { confirm_password: _c, ...payload } = values;
    const finalPayload: Record<string, unknown> = { ...payload };
    if (googleData?.google_id) {
      finalPayload.google_id = googleData.google_id;
    }
    try {
      await dispatch(candidateRegister(finalPayload)).unwrap();
      if (shareLink) navigate(`/candidate/login?share=${shareLink}`);
      else navigate("/candidate/dashboard");
    } catch (e: unknown) {
      setError("root", { message: (e as { message?: string })?.message || "Registration failed" });
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Left: register form */}
        <div className={styles.left}>
          <div className={styles.formWrap}>
            <div className={styles.brand}>
              <img src={logoUrl} width="44" height="44" alt="SoftSuave Hire" />
              <h1 className={styles.brandName}>SoftSuave Hire</h1>
              <span className={styles.portalPill}>Create Account</span>
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
                      options={[
                        { value: "male", label: "Male" },
                        { value: "female", label: "Female" },
                        { value: "other", label: "Other" },
                      ]}
                      error={errors.gender?.message}
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
                  label="College City"
                  placeholder="City (optional)"
                  autoComplete="address-level2"
                  error={errors.college_city?.message}
                  {...register("college_city")}
                />
              </div>
              <div className={styles.row}>
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
              </div>
              {errors.root && <p className={styles.error}>{errors.root.message}</p>}
              <Button
                type="submit"
                fullWidth
                isLoading={isSubmitting}
                className={styles.submitBtn}
              >
                Create Account
              </Button>
            </form>

            <p className={styles.footer}>
              Already have an account?{" "}
              <Link
                to={shareLink ? `/candidate/login?share=${shareLink}` : "/candidate/login"}
                className={styles.link}
              >
                Sign in
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
            <h2 className={styles.welcomeTitle}>Get Started!</h2>
            <p className={styles.welcomeSub}>Create your account to begin</p>
          </div>
        </div>
      </div>
    </div>
  );
}
