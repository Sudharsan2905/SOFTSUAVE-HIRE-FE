import type { ProfileFormState, PasswordFormState } from "../types/profile.types";

export const PROFILE_FORM_DEFAULTS: ProfileFormState = {
  first_name: "",
  last_name: "",
  email: "",
  role: "",
  is_active: true,
  default_workspace_id: "",
  workspace_ids: [],
};

export const PASSWORD_FORM_DEFAULTS: PasswordFormState = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};
