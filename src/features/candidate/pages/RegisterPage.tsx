import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import styles from "./RegisterPage.module.css";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useAppDispatch } from "@/store";
import { candidateRegister } from "@/store/slices/authSlice";
import { IconEye, IconEyeOff } from "@/assets/icons";
import logoUrl from "@/assets/favicon.svg";

const passwordSchema = z
  .string()
  .min(8, "Min 8 characters")
  .regex(/[A-Z]/, "Must include an uppercase letter")
  .regex(/[a-z]/, "Must include a lowercase letter")
  .regex(/[0-9]/, "Must include a digit")
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
  const [searchParams] = useSearchParams();
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const shareLink = searchParams.get("share");

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormData) => {
    const { confirm_password: _confirm_password, ...payload } = values;
    try {
      await dispatch(candidateRegister(payload)).unwrap();
      if (shareLink) navigate(`/assessment/${shareLink}/instructions`);
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

            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.row}>
            <Input
              label="First Name *"
              placeholder="John"
              error={errors.first_name?.message}
              {...register("first_name")}
            />
            <Input
              label="Last Name"
              placeholder="Doe (optional)"
              error={errors.last_name?.message}
              {...register("last_name")}
            />
          </div>
          <Input
            label="Email *"
            type="email"
            placeholder="john@email.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Phone *"
            placeholder="+91 9876543210"
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
            <Input
              label="Date of Birth"
              type="date"
              error={errors.dob?.message}
              {...register("dob")}
            />
          </div>
          <div className={styles.row}>
            <Input
              label="College / Institution"
              placeholder="University name (optional)"
              error={errors.college_name?.message}
              {...register("college_name")}
            />
            <Input
              label="College City"
              placeholder="City (optional)"
              error={errors.college_city?.message}
              {...register("college_city")}
            />
          </div>
          <div className={styles.row}>
            <Input
              label="Password *"
              type={showPass ? "text" : "password"}
              placeholder="Min 8 characters"
              error={errors.password?.message}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-tertiary)",
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
              error={errors.confirm_password?.message}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-tertiary)",
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
          <div className={styles.heroWrap}>
            <div className={styles.badge} aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#FBBF24">
                <path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z" />
              </svg>
            </div>
            <div className={styles.heroCard}>
              <img src="/person.svg" alt="" className={styles.heroImg} />
            </div>
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
