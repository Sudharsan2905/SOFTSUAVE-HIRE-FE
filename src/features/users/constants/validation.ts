import { z } from "zod";
import { FIELD_LIMITS } from "@/constants/validation";
import { UserRole } from "@/constants/enums";

export const createUserSchema = z.object({
  first_name: z
    .string()
    .min(FIELD_LIMITS.NAME_MIN, `First name must be at least ${FIELD_LIMITS.NAME_MIN} characters`),
  last_name: z.string().optional(),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(
      FIELD_LIMITS.PASSWORD_MIN,
      `Password must be at least ${FIELD_LIMITS.PASSWORD_MIN} characters`
    ),
  role: z.enum([UserRole.ADMIN, UserRole.CANDIDATE, UserRole.SUPER_ADMIN]),
});

export type CreateUserSchema = z.infer<typeof createUserSchema>;
