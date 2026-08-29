import { createHmac, randomBytes as nodeRandomBytes, timingSafeEqual } from 'node:crypto';

export const PARTICIPANT_COOKIE_NAME = '__Host-powercuts_participant';
export const PARTICIPANT_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;

interface ParticipantTokenPayload {
  id: string;
  iat: number;
  exp: number;
}

export interface IssuedParticipantToken {
  token: string;
  participantId: string;
  expiresAtMs: number;
}

export interface ParticipantTokenClaims {
  participantId: string;
  expiresAtMs: number;
}

export interface ParticipantTokenIssueOptions {
  nowMs?: number;
  ttlSeconds?: number;
  randomBytes?: (size: number) => Uint8Array;
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update('participant-token:v1', 'utf8')
    .update('\0', 'utf8')
    .update(payload, 'utf8')
    .digest('base64url');
}

export function issueParticipantToken(
  secret: string,
  options: ParticipantTokenIssueOptions = {},
): IssuedParticipantToken {
  const nowMs = options.nowMs ?? Date.now();
  const ttlSeconds = options.ttlSeconds ?? PARTICIPANT_TOKEN_TTL_SECONDS;
  const randomBytes = options.randomBytes ?? nodeRandomBytes;
  const issuedAt = Math.floor(nowMs / 1000);
  const expiresAt = issuedAt + ttlSeconds;
  const participantId = Buffer.from(randomBytes(32)).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ id: participantId, iat: issuedAt, exp: expiresAt }),
    'utf8',
  ).toString('base64url');
  const signature = signPayload(payload, secret);

  return {
    token: `v1.${payload}.${signature}`,
    participantId,
    expiresAtMs: expiresAt * 1000,
  };
}

export function verifyParticipantToken(
  token: string,
  secret: string,
  nowMs = Date.now(),
): ParticipantTokenClaims | null {
  if (token.length > 2048) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    return null;
  }

  const payload = parts[1];
  const signature = parts[2];
  if (!payload || !signature || !/^[A-Za-z0-9_-]{43}$/u.test(signature)) {
    return null;
  }

  const expected = Buffer.from(signPayload(payload, secret), 'base64url');
  const received = Buffer.from(signature, 'base64url');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (
    typeof claims !== 'object'
    || claims === null
    || !('id' in claims)
    || !('iat' in claims)
    || !('exp' in claims)
  ) {
    return null;
  }

  const { id, iat, exp } = claims as ParticipantTokenPayload;
  const nowSeconds = Math.floor(nowMs / 1000);
  if (
    typeof id !== 'string'
    || !/^[A-Za-z0-9_-]{43}$/u.test(id)
    || !Number.isSafeInteger(iat)
    || !Number.isSafeInteger(exp)
    || exp <= iat
    || iat > nowSeconds + 300
    || exp <= nowSeconds
  ) {
    return null;
  }

  return {
    participantId: id,
    expiresAtMs: exp * 1000,
  };
}

export function readParticipantCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (separator < 0) {
      continue;
    }
    const name = cookie.slice(0, separator).trim();
    if (name === PARTICIPANT_COOKIE_NAME) {
      return cookie.slice(separator + 1).trim() || null;
    }
  }

  return null;
}

export function serializeParticipantCookie(
  token: string,
  maxAgeSeconds = PARTICIPANT_TOKEN_TTL_SECONDS,
): string {
  return [
    `${PARTICIPANT_COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${Math.max(1, Math.floor(maxAgeSeconds))}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
}
