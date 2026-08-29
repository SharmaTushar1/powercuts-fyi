import { createHmac } from 'node:crypto';

function deriveHash(domain: string, value: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(domain, 'utf8')
    .update('\0', 'utf8')
    .update(value, 'utf8')
    .digest('hex');
}

export function deriveParticipantHash(participantId: string, secret: string): string {
  return deriveHash('participant:v1', participantId, secret);
}

export function deriveRateLimitHash(
  scope: string,
  rawIdentifier: string,
  secret: string,
): string {
  return deriveHash(`rate-limit:v1:${scope}`, rawIdentifier, secret);
}
