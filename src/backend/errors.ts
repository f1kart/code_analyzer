export class AppError<T = unknown> extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: T | undefined;

  constructor(
    message: string,
    options: { status?: number; code?: string; details?: T } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = options.status || 500;
    this.code = options.code || 'internal_error';
    this.details = options.details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError<T> extends AppError<T> {
  constructor(message: string, details?: T) {
    super(message, { status: 400, code: 'validation_error', details });
  }
}

export class NotFoundError<T> extends AppError<T> {
  constructor(message: string, details?: T) {
    super(message, { status: 404, code: 'not_found', details });
  }
}

export class ConflictError<T> extends AppError<T> {
  constructor(message: string, details?: T) {
    super(message, { status: 409, code: 'conflict', details });
  }
}

export class UnauthorizedError extends AppError<never> {
  constructor(message = 'Unauthorized') {
    super(message, { status: 401, code: 'unauthorized' });
  }
}

export const mapErrorToResponse = (
  error: unknown
): { status: number; body: { error: string; message: string; details?: unknown } } => {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      body: {
        error: 'internal_error',
        message: 'An unexpected error occurred',
        details: { name: error.name, message: error.message },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: 'internal_error',
      message: 'An unknown error occurred',
    },
  };
};
