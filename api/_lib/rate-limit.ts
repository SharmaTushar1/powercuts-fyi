import { z } from 'zod';

const rpcRowSchema = z.object({
  allowed: z.boolean(),
  remaining: z.number().int().nonnegative(),
  retry_after_seconds: z.number().int().nonnegative(),
});

const rpcDataSchema = z.array(rpcRowSchema).length(1);

export interface RateLimitRule {
  scope: string;
  identifierHash: string;
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitRpcArguments {
  p_scope: string;
  p_identifier_hash: string;
  p_max_requests: number;
  p_window_seconds: number;
}

export interface RateLimitRpcResult {
  data: unknown;
  error: unknown;
}

export type RateLimitExecutor = (
  arguments_: RateLimitRpcArguments,
) => PromiseLike<RateLimitRpcResult>;

export type RateLimitDecision =
  | { kind: 'allowed'; remaining: number }
  | { kind: 'blocked'; retryAfterSeconds: number }
  | { kind: 'unavailable' };

export function mapRateLimitDecision(result: RateLimitRpcResult): RateLimitDecision {
  if (result.error) {
    return { kind: 'unavailable' };
  }

  const parsed = rpcDataSchema.safeParse(result.data);
  if (!parsed.success) {
    return { kind: 'unavailable' };
  }

  const row = parsed.data[0];
  if (!row) {
    return { kind: 'unavailable' };
  }

  return row.allowed
    ? { kind: 'allowed', remaining: row.remaining }
    : { kind: 'blocked', retryAfterSeconds: row.retry_after_seconds };
}

export async function checkRateLimit(
  execute: RateLimitExecutor,
  rule: RateLimitRule,
): Promise<RateLimitDecision> {
  try {
    const result = await execute({
      p_scope: rule.scope,
      p_identifier_hash: rule.identifierHash,
      p_max_requests: rule.maxRequests,
      p_window_seconds: rule.windowSeconds,
    });
    return mapRateLimitDecision(result);
  } catch {
    return { kind: 'unavailable' };
  }
}
