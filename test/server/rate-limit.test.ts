import { describe, expect, it, vi } from 'vitest';
import { checkRateLimit, mapRateLimitDecision } from '../../server/rate-limit';

describe('rate-limit decision mapping', () => {
  it('maps an allowed database decision', () => {
    expect(
      mapRateLimitDecision({
        data: [{ allowed: true, remaining: 7, retry_after_seconds: 0 }],
        error: null,
      }),
    ).toEqual({ kind: 'allowed', remaining: 7 });
  });

  it('maps a denied database decision to a retry delay', () => {
    expect(
      mapRateLimitDecision({
        data: [{ allowed: false, remaining: 0, retry_after_seconds: 42 }],
        error: null,
      }),
    ).toEqual({ kind: 'blocked', retryAfterSeconds: 42 });
  });

  it('fails closed for database errors or malformed results', () => {
    expect(
      mapRateLimitDecision({
        data: null,
        error: { message: 'database unavailable' },
      }),
    ).toEqual({ kind: 'unavailable' });

    expect(mapRateLimitDecision({ data: [{}], error: null })).toEqual({
      kind: 'unavailable',
    });
  });

  it('passes a bounded rule to the atomic database function', async () => {
    const execute = vi.fn().mockResolvedValue({
      data: [{ allowed: true, remaining: 2, retry_after_seconds: 0 }],
      error: null,
    });

    const decision = await checkRateLimit(execute, {
      scope: 'incidents:participant',
      identifierHash: 'a'.repeat(64),
      maxRequests: 3,
      windowSeconds: 3600,
    });

    expect(execute).toHaveBeenCalledWith({
      p_scope: 'incidents:participant',
      p_identifier_hash: 'a'.repeat(64),
      p_max_requests: 3,
      p_window_seconds: 3600,
    });
    expect(decision).toEqual({ kind: 'allowed', remaining: 2 });
  });
});
