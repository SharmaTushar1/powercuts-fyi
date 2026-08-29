import { deriveParticipantHash, deriveRateLimitHash } from './crypto';
import { ApiError } from './http';
import type {
  IssuedParticipantToken,
  ParticipantTokenClaims,
} from './participant-token';
import type { RateLimitDecision, RateLimitRule } from './rate-limit';
import type {
  TurnstileVerificationInput,
  TurnstileVerificationResult,
} from './turnstile';

export interface MutationGuardInput {
  turnstileToken: string;
  remoteIp?: string;
  participantToken: string | null;
  scope: string;
  hmacSecret: string;
  participantTokenSecret: string;
  turnstileSecret: string;
  allowedHostnames: readonly string[];
  expectedAction: string;
  participantLimit: number;
  ipPreLimit: number;
  tokenIssuanceLimit: number;
  windowSeconds: number;
  tokenIssuanceWindowSeconds: number;
}

export interface MutationGuardDependencies {
  checkRateLimit: (rule: RateLimitRule) => Promise<RateLimitDecision>;
  verifyTurnstile: (
    input: TurnstileVerificationInput,
  ) => Promise<TurnstileVerificationResult>;
  issueParticipantToken: (secret: string) => IssuedParticipantToken;
  verifyParticipantToken: (
    token: string,
    secret: string,
  ) => ParticipantTokenClaims | null;
}

function assertRateLimitAllowed(decision: RateLimitDecision): void {
  if (decision.kind === 'blocked') {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many requests', {
      retryAfterSeconds: decision.retryAfterSeconds,
    });
  }

  if (decision.kind === 'unavailable') {
    throw new ApiError(
      503,
      'SERVICE_UNAVAILABLE',
      'Request protection is temporarily unavailable',
    );
  }
}

export async function protectMutation(
  input: MutationGuardInput,
  dependencies: MutationGuardDependencies,
): Promise<{ participantHash: string; participantTokenToSet?: string }> {
  if (!input.remoteIp) {
    throw new ApiError(
      503,
      'SERVICE_UNAVAILABLE',
      'Request protection is temporarily unavailable',
    );
  }

  const existingClaims = input.participantToken
    ? dependencies.verifyParticipantToken(
        input.participantToken,
        input.participantTokenSecret,
      )
    : null;
  if (input.participantToken && !existingClaims) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid participant identity');
  }

  const ipRateLimitHash = deriveRateLimitHash(
    `${input.scope}:ip-pre`,
    input.remoteIp,
    input.hmacSecret,
  );
  assertRateLimitAllowed(
    await dependencies.checkRateLimit({
      scope: `${input.scope}:ip-pre`,
      identifierHash: ipRateLimitHash,
      maxRequests: input.ipPreLimit,
      windowSeconds: input.windowSeconds,
    }),
  );

  let verification: TurnstileVerificationResult;
  try {
    verification = await dependencies.verifyTurnstile({
      token: input.turnstileToken,
      secret: input.turnstileSecret,
      remoteIp: input.remoteIp,
      allowedHostnames: input.allowedHostnames,
      expectedAction: input.expectedAction,
    });
  } catch (error) {
    throw new ApiError(
      503,
      'SERVICE_UNAVAILABLE',
      'CAPTCHA verification is temporarily unavailable',
      { cause: error },
    );
  }

  if (!verification.success) {
    throw new ApiError(403, 'CAPTCHA_FAILED', 'CAPTCHA verification failed');
  }

  let issuedToken: IssuedParticipantToken | undefined;
  let claims = existingClaims;
  if (!claims) {
    const issuanceRateLimitHash = deriveRateLimitHash(
      'participant-token:issue:ip',
      input.remoteIp,
      input.hmacSecret,
    );
    assertRateLimitAllowed(
      await dependencies.checkRateLimit({
        scope: 'participant-token:issue:ip',
        identifierHash: issuanceRateLimitHash,
        maxRequests: input.tokenIssuanceLimit,
        windowSeconds: input.tokenIssuanceWindowSeconds,
      }),
    );
    issuedToken = dependencies.issueParticipantToken(
      input.participantTokenSecret,
    );
    claims = {
      participantId: issuedToken.participantId,
      expiresAtMs: issuedToken.expiresAtMs,
    };
  }

  const participantRateLimitHash = deriveRateLimitHash(
    `${input.scope}:participant`,
    claims.participantId,
    input.hmacSecret,
  );
  assertRateLimitAllowed(
    await dependencies.checkRateLimit({
      scope: `${input.scope}:participant`,
      identifierHash: participantRateLimitHash,
      maxRequests: input.participantLimit,
      windowSeconds: input.windowSeconds,
    }),
  );

  return {
    participantHash: deriveParticipantHash(
      claims.participantId,
      input.hmacSecret,
    ),
    ...(issuedToken ? { participantTokenToSet: issuedToken.token } : {}),
  };
}
