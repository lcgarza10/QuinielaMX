export interface ErrorDetails {
  code: string;
  message: string;
  technical?: string;
}

export function handleError(error: any): ErrorDetails {
  // Firebase Auth Errors
  if (error.code?.startsWith('auth/')) {
    return handleAuthError(error.code);
  }
  
  // API Errors
  if (error.status) {
    return handleApiError(error);
  }
  
  // Generic Errors
  return {
    code: 'unknown_error',
    message: 'An unexpected error occurred. Please try again.',
    technical: error.message || error.toString()
  };
}

function handleAuthError(code: string): ErrorDetails {
  const errorMap: { [key: string]: string } = {
    'auth/user-not-found': 'No existe una cuenta con este correo electrónico',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/invalid-email': 'Correo electrónico inválido',
    'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
    'auth/email-already-in-use': 'Este correo electrónico ya está registrado',
    'auth/operation-not-allowed': 'Operación no permitida',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
    'auth/too-many-requests': 'Demasiados intentos fallidos. Por favor, intenta más tarde'
  };

  return {
    code,
    message: errorMap[code] || 'Error de autenticación',
    technical: code
  };
}

function handleApiError(error: any): ErrorDetails {
  if (error.status === 429) {
    return {
      code: 'rate_limit_exceeded',
      message: 'Se ha alcanzado el límite de la API. Por favor, intenta más tarde.',
      technical: error.message
    };
  }

  if (error.status === 401) {
    return {
      code: 'unauthorized',
      message: 'No autorizado. Por favor, inicia sesión nuevamente.',
      technical: error.message
    };
  }

  return {
    code: `http_${error.status}`,
    message: 'Error de comunicación con el servidor',
    technical: error.message
  };
}

export function logError(error: ErrorDetails): void {
  console.error('Error:', {
    code: error.code,
    message: error.message,
    technical: error.technical
  });
}