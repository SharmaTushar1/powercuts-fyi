import { describe, expect, it, vi } from 'vitest';
import { TurnstileUnavailableError, verifyTurnstile } from './turnstile';

describe('Turnstile verification', () => {
  it('returns a failed verification from an injected verifier response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          'error-codes': ['invalid-input-response'],
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await verifyTurnstile(
      {
        token: 'invalid-token',
        secret: 'server-secret',
        remoteIp: '203.0.113.7',
        allowedHostnames: ['powercuts.fyi'],
        expectedAction: 'report-incident',
      },
      fetchImpl,
    );

    expect(result).toEqual({
      success: false,
      errorCodes: ['invalid-input-response'],
    });
    expect(fetchImpl).toHaveBeenCalledOnce();

    const request = fetchImpl.mock.calls[0]?.[1];
    expect(request?.method).toBe('POST');
    expect(String(request?.body)).toContain('response=invalid-token');
    expect(String(request?.body)).toContain('remoteip=203.0.113.7');
  });

  it('fails closed when the verification service is unavailable', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('unavailable', { status: 503 }));

    await expect(
      verifyTurnstile(
        {
          token: 'token',
          secret: 'secret',
          allowedHostnames: ['powercuts.fyi'],
          expectedAction: 'report-incident',
        },
        fetchImpl,
      ),
    ).rejects.toBeInstanceOf(TurnstileUnavailableError);
  });

  it('accepts only the configured hostname and route action', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: 'powercuts.fyi',
          action: 'report-incident',
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      verifyTurnstile(
        {
          token: 'token',
          secret: 'secret',
          allowedHostnames: ['powercuts.fyi'],
          expectedAction: 'report-incident',
        },
        fetchImpl,
      ),
    ).resolves.toEqual({ success: true, errorCodes: [] });
  });

  it('rejects a successful challenge from another hostname', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: 'attacker.example',
          action: 'report-incident',
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      verifyTurnstile(
        {
          token: 'token',
          secret: 'secret',
          allowedHostnames: ['powercuts.fyi'],
          expectedAction: 'report-incident',
        },
        fetchImpl,
      ),
    ).resolves.toEqual({
      success: false,
      errorCodes: ['hostname-mismatch'],
    });
  });

  it('rejects a challenge created for another route action', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: 'powercuts.fyi',
          action: 'record-observation',
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      verifyTurnstile(
        {
          token: 'token',
          secret: 'secret',
          allowedHostnames: ['powercuts.fyi'],
          expectedAction: 'report-incident',
        },
        fetchImpl,
      ),
    ).resolves.toEqual({
      success: false,
      errorCodes: ['action-mismatch'],
    });
  });
});
