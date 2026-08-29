import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, getRequestIp, sendApiError, sendData } from '../../server/http';

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

describe('API response helpers', () => {
  it('extracts the first trusted proxy address from a forwarded chain', () => {
    const request = {
      headers: {
        'x-forwarded-for': '203.0.113.7, 10.0.0.1',
      },
    };

    expect(getRequestIp(request as unknown as VercelRequest)).toBe('203.0.113.7');
  });

  it('wraps successful data consistently', () => {
    const response = createResponse();

    sendData(response as unknown as VercelResponse, 201, { id: 'incident-id' });

    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({
      data: { id: 'incident-id' },
    });
  });

  it('returns safe structured errors and hides internal causes', () => {
    const response = createResponse();
    const error = new ApiError(429, 'RATE_LIMITED', 'Too many requests', {
      retryAfterSeconds: 30,
      cause: new Error('database detail'),
    });

    sendApiError(response as unknown as VercelResponse, error);

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        details: { retryAfterSeconds: 30 },
      },
    });
  });

  it('maps unknown failures to a generic internal error', () => {
    const response = createResponse();

    sendApiError(response as unknown as VercelResponse, new Error('secret detail'));

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  it('maps schema failures to a validation error without exposing issue details', () => {
    const response = createResponse();
    const result = z.object({ id: z.uuid() }).safeParse({ id: 'invalid' });

    if (result.success) {
      throw new Error('Expected schema validation to fail');
    }

    sendApiError(response as unknown as VercelResponse, result.error);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
      },
    });
  });
});
