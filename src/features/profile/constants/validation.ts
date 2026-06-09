import { z } from "zod";
import { FIELD_LIMITS } from "@/constants/validation";

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z
      .string()
      .min(FIELD_LIMITS.PASSWORD_MIN, `Min ${FIELD_LIMITS.PASSWORD_MIN} characters`)
      .regex(/[A-Z]/, "Must include an uppercase letter")
      .regex(/[a-z]/, "Must include a lowercase letter")
      .regex(/\d/, "Must include a digit")
      .regex(/[^A-Za-z0-9]/, "Must include a special character"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;
