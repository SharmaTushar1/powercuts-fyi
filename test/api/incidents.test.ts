import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, expect, it, vi } from 'vitest';
import type { ServerSupabaseClient } from '../../server/supabase';
import { createIncidentsHandler } from '../../api/incidents';

const environment = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-for-tests',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  PARTICIPANT_HMAC_SECRET: 'hmac-secret-with-at-least-32-characters',
  PARTICIPANT_TOKEN_SECRET: 'token-secret-with-at-least-32-characters',
  TURNSTILE_ALLOWED_HOSTNAMES: ['powercuts.fyi'],
};

const rpcIncident = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  slug: 'pc-123e4567e89b42d3a456426614174000',
  normalized_state: 'maharashtra',
  normalized_city: 'pune',
  normalized_locality: 'shivaji nagar',
  normalized_sector: null,
  state_label: 'Maharashtra',
  city_label: 'Pune',
  locality_label: 'Shivaji Nagar',
  sector_label: null,
  pincode: '411005',
  latitude: 18.5308,
  longitude: 73.8475,
  outage_type: 'unexpected',
  consensus_status: 'ongoing',
  participant_count: 1,
  out_count: 1,
  back_count: 0,
  out_percentage: 100,
  back_percentage: 0,
  created_at: '2026-08-28T10:00:00.000Z',
  updated_at: '2026-08-28T10:00:00.000Z',
  last_activity_at: '2026-08-28T10:00:00.000Z',
  inactive_at: null,
  was_created: true,
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

describe('POST /api/incidents', () => {
  it('normalizes input and invokes the transactional creation RPC', async () => {
    const rpc = vi.fn(async (name: string, _arguments?: unknown) => {
      if (name === 'consume_rate_limit') {
        return {
          data: [{ allowed: true, remaining: 2, retry_after_seconds: 0 }],
          error: null,
        };
      }
      return { data: rpcIncident, error: null };
    });
    const handler = createIncidentsHandler({
      getEnv: () => environment,
      createClient: () => ({ rpc }) as unknown as ServerSupabaseClient,
      verifyTurnstile: vi.fn().mockResolvedValue({
        success: true,
        errorCodes: [],
      }),
    });
    const request = {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.7' },
      body: {
        turnstileToken: 'valid-token',
        state: ' Maharashtra ',
        city: ' Pune ',
        locality: ' Shivaji   Nagar ',
        pincode: '411005',
        latitude: 18.5308,
        longitude: 73.8475,
        outageType: 'unexpected',
      },
    } as unknown as VercelRequest;
    const response = createResponse();

    await handler(request, response as unknown as VercelResponse);

    const creationCall = rpc.mock.calls.find(
      ([name]) => name === 'find_or_create_incident',
    );
    expect(creationCall?.[1]).toMatchObject({
      p_normalized_state: 'maharashtra',
      p_normalized_city: 'pune',
      p_normalized_locality: 'shivaji nagar',
      p_normalized_sector: null,
      p_participant_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringMatching(
        /^__Host-powercuts_participant=.*HttpOnly.*Secure.*SameSite=Lax/u,
      ),
    );
    expect(response.json).toHaveBeenCalledWith({
      data: expect.objectContaining({ wasCreated: true }),
    });
  });

  it('reuses a valid participant cookie without issuing another', async () => {
    const rpc = vi.fn(async (name: string, _arguments?: unknown) => {
      if (name === 'consume_rate_limit') {
        return {
          data: [{ allowed: true, remaining: 2, retry_after_seconds: 0 }],
          error: null,
        };
      }
      return { data: rpcIncident, error: null };
    });
    const handler = createIncidentsHandler({
      getEnv: () => environment,
      createClient: () => ({ rpc }) as unknown as ServerSupabaseClient,
      verifyTurnstile: vi.fn().mockResolvedValue({
        success: true,
        errorCodes: [],
      }),
    });
    const body = {
      turnstileToken: 'valid-token',
      state: 'Maharashtra',
      city: 'Pune',
      locality: 'Shivaji Nagar',
      pincode: '411005',
      latitude: 18.5308,
      longitude: 73.8475,
      outageType: 'unexpected',
    };
    const firstResponse = createResponse();
    await handler(
      {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.7' },
        body,
      } as unknown as VercelRequest,
      firstResponse as unknown as VercelResponse,
    );
    const setCookieCall = firstResponse.setHeader.mock.calls.find(
      ([name]) => name === 'Set-Cookie',
    );
    const cookiePair = String(setCookieCall?.[1]).split(';')[0];
    const secondResponse = createResponse();

    await handler(
      {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.7',
          cookie: cookiePair,
        },
        body,
      } as unknown as VercelRequest,
      secondResponse as unknown as VercelResponse,
    );

    expect(
      secondResponse.setHeader.mock.calls.some(([name]) => name === 'Set-Cookie'),
    ).toBe(false);
    expect(secondResponse.status).toHaveBeenCalledWith(201);
  });
});
