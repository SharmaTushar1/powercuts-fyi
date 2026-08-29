import { describe, expect, it } from 'vitest';
import {
  issueParticipantToken,
  PARTICIPANT_COOKIE_NAME,
  readParticipantCookie,
  serializeParticipantCookie,
  verifyParticipantToken,
} from './participant-token';

const secret = 'participant-token-secret-with-32-characters';
const nowMs = Date.parse('2026-08-28T12:00:00.000Z');

describe('signed participant identity', () => {
  it('issues and verifies a stable opaque participant token', () => {
    const issued = issueParticipantToken(secret, {
      nowMs,
      randomBytes: () => Buffer.alloc(32, 7),
    });

    expect(issued.participantId).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(verifyParticipantToken(issued.token, secret, nowMs)).toEqual({
      participantId: issued.participantId,
      expiresAtMs: issued.expiresAtMs,
    });
  });

  it('rejects a token with a tampered signature', () => {
    const issued = issueParticipantToken(secret, {
      nowMs,
      randomBytes: () => Buffer.alloc(32, 9),
    });
    const replacement = issued.token.endsWith('a') ? 'b' : 'a';
    const tampered = `${issued.token.slice(0, -1)}${replacement}`;

    expect(verifyParticipantToken(tampered, secret, nowMs)).toBeNull();
  });

  it('rejects an expired token', () => {
    const issued = issueParticipantToken(secret, {
      nowMs,
      randomBytes: () => Buffer.alloc(32, 11),
      ttlSeconds: 60,
    });

    expect(
      verifyParticipantToken(issued.token, secret, nowMs + 61_000),
    ).toBeNull();
  });

  it('reads and serializes a hardened host-only participant cookie', () => {
    const cookie = serializeParticipantCookie('signed-token', 3600);

    expect(cookie).toContain(`${PARTICIPANT_COOKIE_NAME}=signed-token`);
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=3600');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(
      readParticipantCookie(`another=value; ${PARTICIPANT_COOKIE_NAME}=signed-token`),
    ).toBe('signed-token');
  });
});
