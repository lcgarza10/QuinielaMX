export interface RegistrationData {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  inviteCode?: string;
}

export interface RegistrationValidation {
  email: boolean;
  password: boolean;
  confirmPassword: boolean;
  username: boolean;
  passwordsMatch: boolean;
}