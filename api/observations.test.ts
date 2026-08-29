import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, expect, it, vi } from 'vitest';
import type { ServerSupabaseClient } from './_lib/supabase';
import { createObservationsHandler } from './observations';

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
  consensus_status: 'resolved',
  participant_count: 2,
  out_count: 0,
  back_count: 2,
  out_percentage: 0,
  back_percentage: 100,
  created_at: '2026-08-28T10:00:00.000Z',
  updated_at: '2026-08-28T10:05:00.000Z',
  last_activity_at: '2026-08-28T10:05:00.000Z',
  inactive_at: null,
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

describe('POST /api/observations', () => {
  it('records an immutable observation through the transactional RPC', async () => {
    const rpc = vi.fn(async (name: string, _arguments?: unknown) => {
      if (name === 'consume_rate_limit') {
        return {
          data: [{ allowed: true, remaining: 20, retry_after_seconds: 0 }],
          error: null,
        };
      }
      return { data: rpcIncident, error: null };
    });
    const verifyTurnstile = vi.fn().mockResolvedValue({
      success: true,
      errorCodes: [],
    });
    const handler = createObservationsHandler({
      getEnv: () => environment,
      createClient: () => ({ rpc }) as unknown as ServerSupabaseClient,
      verifyTurnstile,
    });
    const request = {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.7' },
      body: {
        turnstileToken: 'valid-token',
        incidentId: '123e4567-e89b-42d3-a456-426614174000',
        state: 'back',
      },
    } as unknown as VercelRequest;
    const response = createResponse();

    await handler(request, response as unknown as VercelResponse);

    const observationCall = rpc.mock.calls.find(
      ([name]) => name === 'record_observation',
    );
    expect(observationCall?.[1]).toMatchObject({
      p_incident_id: '123e4567-e89b-42d3-a456-426614174000',
      p_participant_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      p_state: 'back',
    });
    expect(verifyTurnstile).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedHostnames: ['powercuts.fyi'],
        expectedAction: 'record-observation',
      }),
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('HttpOnly'),
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      data: expect.objectContaining({
        incident: expect.objectContaining({ status: 'resolved' }),
      }),
    });
  });
});
