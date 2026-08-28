import { isIP } from 'node:net';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';

export type ApiErrorCode =
  | 'CAPTCHA_FAILED'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'METHOD_NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR';

type ApiErrorDetails = Record<string, unknown> & {
  cause?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    options: ApiErrorDetails = {},
  ) {
    const { cause, ...details } = options;
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = Object.keys(details).length > 0 ? details : undefined;
  }
}

export function getRequestIp(request: VercelRequest): string | undefined {
  const forwarded =
    request.headers['x-vercel-forwarded-for'] ?? request.headers['x-forwarded-for'];
  const rawValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const candidate = rawValue?.split(',')[0]?.trim();

  return candidate && isIP(candidate) !== 0 ? candidate : undefined;
}

export function sendData<T>(
  response: VercelResponse,
  status: number,
  data: T,
): VercelResponse {
  return response.status(status).json({ data });
}

export function sendApiError(
  response: VercelResponse,
  error: unknown,
): VercelResponse {
  if (error instanceof ZodError) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
      },
    });
  }

  if (error instanceof ApiError) {
    const retryAfter = error.details?.retryAfterSeconds;
    if (typeof retryAfter === 'number' && Number.isFinite(retryAfter)) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfter))));
    }

    return response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }

  return response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

export function sendMethodNotAllowed(
  response: VercelResponse,
  allowedMethods: readonly string[],
): VercelResponse {
  response.setHeader('Allow', allowedMethods.join(', '));
  return sendApiError(
    response,
    new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed'),
  );
}
