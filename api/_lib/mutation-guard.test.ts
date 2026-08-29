import { describe, expect, it, vi } from 'vitest';
import { protectMutation } from './mutation-guard';

const baseInput = {
  turnstileToken: 'captcha-token',
  remoteIp: '203.0.113.7',
  participantToken: null,
  scope: 'incidents',
  hmacSecret: 'test-hmac-secret-with-at-least-32-characters',
  participantTokenSecret: 'token-secret-with-at-least-32-characters',
  turnstileSecret: 'turnstile-secret',
  allowedHostnames: ['powercuts.fyi'],
  expectedAction: 'report-incident',
  participantLimit: 3,
  ipPreLimit: 20,
  tokenIssuanceLimit: 3,
  windowSeconds: 3600,
  tokenIssuanceWindowSeconds: 86400,
};

const issuedToken = {
  token: 'signed-participant-token',
  participantId: 'server-generated-participant-id',
  expiresAtMs: Date.parse('2027-08-28T12:00:00.000Z'),
};

describe('protected mutation guard', () => {
  it('verifies Turnstile before issuance and participant quotas', async () => {
    const order: string[] = [];
    const checkRateLimit = vi.fn(async (rule: { scope: string }) => {
      order.push(`rate:${rule.scope}`);
      return {
        kind: 'allowed' as const,
        remaining: 2,
      };
    });
    const verify = vi.fn(async () => {
      order.push('turnstile');
      return {
        success: true,
        errorCodes: [],
      };
    });
    const issue = vi.fn(() => {
      order.push('issue');
      return issuedToken;
    });

    const result = await protectMutation(baseInput, {
      checkRateLimit,
      verifyTurnstile: verify,
      issueParticipantToken: issue,
      verifyParticipantToken: vi.fn(),
    });

    expect(order).toEqual([
      'rate:incidents:ip-pre',
      'turnstile',
      'rate:participant-token:issue:ip',
      'issue',
      'rate:incidents:participant',
    ]);
    expect(result).toMatchObject({
      participantTokenToSet: 'signed-participant-token',
      participantHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
  });

  it('reuses a valid signed participant without consuming issuance quota', async () => {
    const checkRateLimit = vi.fn().mockResolvedValue({
      kind: 'allowed',
      remaining: 2,
    });
    const verify = vi.fn().mockResolvedValue({
      success: true,
      errorCodes: [],
    });
    const issue = vi.fn();

    const result = await protectMutation(
      { ...baseInput, participantToken: 'valid-signed-token' },
      {
        checkRateLimit,
        verifyTurnstile: verify,
        issueParticipantToken: issue,
        verifyParticipantToken: vi.fn().mockReturnValue({
          participantId: 'existing-server-participant',
          expiresAtMs: issuedToken.expiresAtMs,
        }),
      },
    );

    expect(checkRateLimit.mock.calls.map(([rule]) => rule.scope)).toEqual([
      'incidents:ip-pre',
      'incidents:participant',
    ]);
    expect(issue).not.toHaveBeenCalled();
    expect(result.participantTokenToSet).toBeUndefined();
  });

  it('rejects a failed Turnstile challenge before participant quota', async () => {
    const checkRateLimit = vi.fn().mockResolvedValue({
      kind: 'allowed',
      remaining: 2,
    });
    const verify = vi.fn().mockResolvedValue({
      success: false,
      errorCodes: ['invalid-input-response'],
    });

    await expect(
      protectMutation(baseInput, {
        checkRateLimit,
        verifyTurnstile: verify,
        issueParticipantToken: vi.fn(),
        verifyParticipantToken: vi.fn(),
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: 'CAPTCHA_FAILED',
    });

    expect(checkRateLimit).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledWith({
      token: 'captcha-token',
      secret: 'turnstile-secret',
      remoteIp: '203.0.113.7',
      allowedHostnames: ['powercuts.fyi'],
      expectedAction: 'report-incident',
    });
  });

  it('rejects a blocked coarse IP before calling Turnstile', async () => {
    const checkRateLimit = vi.fn().mockResolvedValue({
      kind: 'blocked',
      retryAfterSeconds: 90,
    });
    const verify = vi.fn();

    await expect(
      protectMutation(baseInput, {
        checkRateLimit,
        verifyTurnstile: verify,
        issueParticipantToken: vi.fn(),
        verifyParticipantToken: vi.fn(),
      }),
    ).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      details: { retryAfterSeconds: 90 },
    });

    expect(checkRateLimit).toHaveBeenCalledOnce();
    expect(verify).not.toHaveBeenCalled();
  });

  it('fails closed when the rate-limit store is unavailable', async () => {
    await expect(
      protectMutation(baseInput, {
        checkRateLimit: vi.fn().mockResolvedValue({ kind: 'unavailable' }),
        verifyTurnstile: vi.fn(),
        issueParticipantToken: vi.fn(),
        verifyParticipantToken: vi.fn(),
      }),
    ).rejects.toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('maps a Turnstile outage to service unavailable', async () => {
    await expect(
      protectMutation(baseInput, {
        checkRateLimit: vi.fn().mockResolvedValue({
          kind: 'allowed',
          remaining: 1,
        }),
        verifyTurnstile: vi.fn().mockRejectedValue(new Error('network detail')),
        issueParticipantToken: vi.fn(),
        verifyParticipantToken: vi.fn(),
      }),
    ).rejects.toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('rejects a presented token that fails signature verification', async () => {
    await expect(
      protectMutation(
        { ...baseInput, participantToken: 'tampered-token' },
        {
          checkRateLimit: vi.fn(),
          verifyTurnstile: vi.fn(),
          issueParticipantToken: vi.fn(),
          verifyParticipantToken: vi.fn().mockReturnValue(null),
        },
      ),
    ).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('fails closed when a trusted client IP is unavailable', async () => {
    const { remoteIp: _remoteIp, ...withoutIp } = baseInput;
    const verify = vi.fn();

    await expect(
      protectMutation(withoutIp, {
        checkRateLimit: vi.fn(),
        verifyTurnstile: verify,
        issueParticipantToken: vi.fn(),
        verifyParticipantToken: vi.fn(),
      }),
    ).rejects.toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });

    expect(verify).not.toHaveBeenCalled();
  });
});
