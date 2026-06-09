import { UserRole } from "@/constants/enums";
import type { CreateUserForm } from "../types/users.types";

export const CREATE_USER_FORM_DEFAULTS: CreateUserForm = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  role: UserRole.ADMIN,
};
