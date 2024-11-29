export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateRequired(value: any): ValidationResult {
  const isValid = value !== null && value !== undefined && value !== '';
  return {
    isValid,
    errors: isValid ? [] : ['This field is required']
  };
}

export function validateMinLength(value: string, minLength: number): ValidationResult {
  const isValid = value.length >= minLength;
  return {
    isValid,
    errors: isValid ? [] : [`Minimum length is ${minLength} characters`]
  };
}

export function validateMaxLength(value: string, maxLength: number): ValidationResult {
  const isValid = value.length <= maxLength;
  return {
    isValid,
    errors: isValid ? [] : [`Maximum length is ${maxLength} characters`]
  };
}

export function validatePattern(value: string, pattern: RegExp): ValidationResult {
  const isValid = pattern.test(value);
  return {
    isValid,
    errors: isValid ? [] : ['Invalid format']
  };
}

export function validateRange(value: number, min: number, max: number): ValidationResult {
  const isValid = value >= min && value <= max;
  return {
    isValid,
    errors: isValid ? [] : [`Value must be between ${min} and ${max}`]
  };
}

export function validateEmail(email: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(email);
  return {
    isValid,
    errors: isValid ? [] : ['Invalid email format']
  };
}

export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}