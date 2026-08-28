import { describe, expect, it } from 'vitest';
import { deriveParticipantHash, deriveRateLimitHash } from './crypto';

const secret = 'test-only-secret-with-at-least-32-characters';

describe('privacy-preserving identifiers', () => {
  it('derives a stable HMAC without exposing the server participant id', () => {
    const participantId = 'server-generated-participant-id';
    const first = deriveParticipantHash(participantId, secret);
    const second = deriveParticipantHash(participantId, secret);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain(participantId);
  });

  it('separates participant and rate-limit hash domains', () => {
    const participant = deriveParticipantHash('same-value-for-test', secret);
    const rateLimit = deriveRateLimitHash('observations:ip', 'same-value-for-test', secret);

    expect(rateLimit).toMatch(/^[a-f0-9]{64}$/);
    expect(rateLimit).not.toBe(participant);
  });
});
