import { z } from "zod";
import { FIELD_LIMITS, REGEX } from "@/constants/validation";

export const adminLoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const candidateLoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const candidateRegisterSchema = z
  .object({
    first_name: z
      .string()
      .min(
        FIELD_LIMITS.NAME_MIN,
        `First name must be at least ${FIELD_LIMITS.NAME_MIN} characters`
      ),
    last_name: z.string().optional(),
    email: z.string().email("Invalid email"),
    phone: z.string().min(FIELD_LIMITS.PHONE_MIN, "Enter a valid phone number"),
    gender: z.enum(["male", "female", "other"], { required_error: "Select a gender" }),
    dob: z.string().optional(),
    college_name: z.string().optional(),
    college_city: z.string().optional(),
    password: z
      .string()
      .min(FIELD_LIMITS.PASSWORD_MIN, `Min ${FIELD_LIMITS.PASSWORD_MIN} characters`)
      .regex(/[A-Z]/, "Must include an uppercase letter")
      .regex(/[a-z]/, "Must include a lowercase letter")
      .regex(/\d/, "Must include a digit")
      .regex(REGEX.PASSWORD_STRONG, "Must include a special character"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type AdminLoginForm = z.infer<typeof adminLoginSchema>;
export type CandidateLoginForm = z.infer<typeof candidateLoginSchema>;
export type CandidateRegisterForm = z.infer<typeof candidateRegisterSchema>;
