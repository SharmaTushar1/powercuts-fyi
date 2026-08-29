import { z } from 'zod';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const turnstileResponseSchema = z
  .object({
    success: z.boolean(),
    'error-codes': z.array(z.string()).optional(),
    hostname: z.string().optional(),
    action: z.string().optional(),
  })
  .passthrough();

export class TurnstileUnavailableError extends Error {
  constructor() {
    super('Turnstile verification is unavailable');
    this.name = 'TurnstileUnavailableError';
  }
}

export interface TurnstileVerificationInput {
  token: string;
  secret: string;
  remoteIp?: string;
  allowedHostnames: readonly string[];
  expectedAction: string;
}

export interface TurnstileVerificationResult {
  success: boolean;
  errorCodes: string[];
}

export async function verifyTurnstile(
  input: TurnstileVerificationInput,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileVerificationResult> {
  const body = new URLSearchParams({
    secret: input.secret,
    response: input.token,
  });

  if (input.remoteIp) {
    body.set('remoteip', input.remoteIp);
  }

  let response: Response;
  try {
    response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new TurnstileUnavailableError();
  }

  if (!response.ok) {
    throw new TurnstileUnavailableError();
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TurnstileUnavailableError();
  }

  const parsed = turnstileResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new TurnstileUnavailableError();
  }

  if (parsed.data.success) {
    const hostname = parsed.data.hostname?.trim().toLowerCase();
    if (!hostname || !input.allowedHostnames.includes(hostname)) {
      return {
        success: false,
        errorCodes: ['hostname-mismatch'],
      };
    }

    if (parsed.data.action !== input.expectedAction) {
      return {
        success: false,
        errorCodes: ['action-mismatch'],
      };
    }
  }

  return {
    success: parsed.data.success,
    errorCodes: parsed.data['error-codes'] ?? [],
  };
}
