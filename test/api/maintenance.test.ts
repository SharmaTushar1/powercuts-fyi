import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, expect, it, vi } from 'vitest';
import type { ServerSupabaseClient } from '../../server/supabase';
import { createMaintenanceHandler } from '../../api/maintenance';

const environment = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'secret-key-for-tests',
  CRON_SECRET: 'cron-secret-with-at-least-32-characters',
};

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

describe('GET /api/maintenance', () => {
  it('rejects requests without the Vercel cron bearer secret', async () => {
    const createClient = vi.fn();
    const handler = createMaintenanceHandler({
      getEnv: () => environment,
      createClient,
    });
    const response = createResponse();

    await handler(
      { method: 'GET', headers: {} } as unknown as VercelRequest,
      response as unknown as VercelResponse,
    );

    expect(createClient).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
  });

  it('marks inactive incidents and prunes expired rate limits', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'mark_inactive_incidents') {
        return { data: 2, error: null };
      }
      return { data: 5, error: null };
    });
    const handler = createMaintenanceHandler({
      getEnv: () => environment,
      createClient: () => ({ rpc }) as unknown as ServerSupabaseClient,
    });
    const response = createResponse();

    await handler(
      {
        method: 'GET',
        headers: { authorization: `Bearer ${environment.CRON_SECRET}` },
      } as unknown as VercelRequest,
      response as unknown as VercelResponse,
    );

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'mark_inactive_incidents',
      'prune_rate_limit_records',
    ]);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      data: {
        inactiveIncidents: 2,
        prunedRateLimitRecords: 5,
      },
    });
  });

  it('treats malformed maintenance RPC results as service failures', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'invalid', error: null });
    const handler = createMaintenanceHandler({
      getEnv: () => environment,
      createClient: () => ({ rpc }) as unknown as ServerSupabaseClient,
    });
    const response = createResponse();

    await handler(
      {
        method: 'GET',
        headers: { authorization: `Bearer ${environment.CRON_SECRET}` },
      } as unknown as VercelRequest,
      response as unknown as VercelResponse,
    );

    expect(response.status).toHaveBeenCalledWith(503);
  });
});
