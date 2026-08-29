import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrowserSupabaseClient } from './supabase';
import {
  createReportsApi,
  mapIncidentRow,
  ReportsApiError,
} from './reportsApi';
import { BrowserEnvironmentError } from './env';
import type {
  CreateOrJoinIncidentPayload,
  Incident,
  SubmitObservationPayload,
} from '../types';

const incidentRow = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  slug: 'pc-123e4567e89b42d3a456426614174000',
  normalized_state: 'karnataka',
  normalized_city: 'bengaluru',
  normalized_locality: 'hsr layout',
  normalized_sector: null,
  state_label: 'Karnataka',
  city_label: 'Bengaluru',
  locality_label: 'HSR Layout',
  sector_label: null,
  pincode: '560102',
  latitude: 12.9121,
  longitude: 77.6446,
  outage_type: 'unexpected',
  consensus_status: 'ongoing',
  participant_count: '4',
  out_count: '3',
  back_count: '1',
  out_percentage: '75.00',
  back_percentage: '25.00',
  created_at: '2026-08-28T10:00:00.000Z',
  updated_at: '2026-08-28T10:05:00.000Z',
  last_activity_at: '2026-08-28T10:05:00.000Z',
  inactive_at: null,
};

const incident: Incident = {
  id: incidentRow.id,
  slug: incidentRow.slug,
  location: {
    normalizedState: 'karnataka',
    normalizedCity: 'bengaluru',
    normalizedLocality: 'hsr layout',
    normalizedSector: null,
    state: 'Karnataka',
    city: 'Bengaluru',
    locality: 'HSR Layout',
    sector: null,
    pincode: '560102',
    latitude: 12.9121,
    longitude: 77.6446,
  },
  outageType: 'unexpected',
  status: 'ongoing',
  consensus: {
    participantCount: 4,
    outCount: 3,
    backCount: 1,
    outPercentage: 75,
    backPercentage: 25,
  },
  createdAt: '2026-08-28T10:00:00.000Z',
  updatedAt: '2026-08-28T10:05:00.000Z',
  lastActivityAt: '2026-08-28T10:05:00.000Z',
  inactiveAt: null,
};

function createClient(rpc: ReturnType<typeof vi.fn>): BrowserSupabaseClient {
  return { rpc } as unknown as BrowserSupabaseClient;
}

function mutationResponse(wasCreated = true): Response {
  return new Response(
    JSON.stringify({
      data: {
        incident: {
          ...incident,
          location: {
            normalizedState: incident.location.normalizedState,
            normalizedCity: incident.location.normalizedCity,
            normalizedLocality: incident.location.normalizedLocality,
            normalizedSector: incident.location.normalizedSector,
            stateLabel: incident.location.state,
            cityLabel: incident.location.city,
            localityLabel: incident.location.locality,
            sectorLabel: incident.location.sector,
            pincode: incident.location.pincode,
            latitude: incident.location.latitude,
            longitude: incident.location.longitude,
          },
        },
        ...(wasCreated ? { wasCreated: true } : {}),
      },
    }),
    {
      status: wasCreated ? 201 : 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('incident row mapping', () => {
  it('maps snake_case database rows into the incident domain model', () => {
    expect(mapIncidentRow(incidentRow)).toEqual(incident);
  });

  it('rejects count and percentage invariants that cannot represent consensus', () => {
    expect(() =>
      mapIncidentRow({ ...incidentRow, participant_count: 5 }),
    ).toThrow(ReportsApiError);
    expect(() =>
      mapIncidentRow({ ...incidentRow, out_percentage: 70 }),
    ).toThrow(ReportsApiError);
  });

  it('rejects null database numerics instead of coercing them to zero', () => {
    expect(() =>
      mapIncidentRow({ ...incidentRow, latitude: null }),
    ).toThrow(ReportsApiError);
    expect(() =>
      mapIncidentRow({
        ...incidentRow,
        participant_count: null,
        out_count: null,
        back_count: null,
        out_percentage: null,
        back_percentage: null,
      }),
    ).toThrow(ReportsApiError);
  });
});

describe('public incident reads', () => {
  it('passes bounded filters and pagination to the filtered read RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ ...incidentRow, total_count: '20120' }],
      error: null,
    });
    const api = createReportsApi({
      getClient: () => createClient(rpc),
      fetch: vi.fn() as unknown as typeof fetch,
    });

    const result = await api.listIncidents({
      state: ' Karnataka ',
      city: ' Bengaluru ',
      locality: ' HSR Layout ',
      sector: ' Sector 2 ',
      outageType: 'unexpected',
      status: 'ongoing',
      activeOnly: true,
      limit: 50,
      offset: 100,
    });

    expect(rpc).toHaveBeenCalledWith('get_public_incidents_filtered', {
      p_state: 'Karnataka',
      p_city: 'Bengaluru',
      p_locality: 'HSR Layout',
      p_sector: 'Sector 2',
      p_outage_type: 'unexpected',
      p_consensus_status: 'ongoing',
      p_active_only: true,
      p_limit: 50,
      p_offset: 100,
    });
    expect(result).toEqual({
      incidents: [incident],
      total: 20_120,
      limit: 50,
      offset: 100,
      hasMore: true,
    });
  });

  it('rejects out-of-range incident pagination instead of repeating a clamped page', async () => {
    const rpc = vi.fn();
    const api = createReportsApi({
      getClient: () => createClient(rpc),
      fetch: vi.fn() as unknown as typeof fetch,
    });

    await expect(
      api.listIncidents({ limit: 250, offset: 20_000 }),
    ).rejects.toMatchObject({
      name: 'ReportsApiError',
      code: 'VALIDATION_ERROR',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('keeps the independent total when a later page is empty', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: null, total_count: '4' }],
      error: null,
    });
    const api = createReportsApi({
      getClient: () => createClient(rpc),
      fetch: vi.fn() as unknown as typeof fetch,
    });

    await expect(api.listIncidents({ offset: 50 })).resolves.toEqual({
      incidents: [],
      total: 4,
      limit: 50,
      offset: 50,
      hasMore: false,
    });
  });

  it('loads one incident directly by slug without scanning the feed', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [incidentRow], error: null });
    const api = createReportsApi({
      getClient: () => createClient(rpc),
      fetch: vi.fn() as unknown as typeof fetch,
    });

    await expect(api.getIncidentBySlug(incident.slug)).resolves.toEqual(incident);
    expect(rpc).toHaveBeenCalledWith('get_incident_by_slug', {
      p_slug: incident.slug,
    });
  });

  it('rejects malformed slugs before querying', async () => {
    const rpc = vi.fn();
    const api = createReportsApi({
      getClient: () => createClient(rpc),
      fetch: vi.fn() as unknown as typeof fetch,
    });

    await expect(api.getIncidentBySlug('not-a-slug')).rejects.toMatchObject({
      name: 'ReportsApiError',
      code: 'VALIDATION_ERROR',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sorts incident pages by activity and id regardless of transport order', async () => {
    const olderRow = {
      ...incidentRow,
      id: '323e4567-e89b-42d3-a456-426614174000',
      slug: 'pc-323e4567e89b42d3a456426614174000',
      last_activity_at: '2026-08-28T09:00:00.000Z',
      total_count: '3',
    };
    const tiedRow = {
      ...incidentRow,
      id: '223e4567-e89b-42d3-a456-426614174000',
      slug: 'pc-223e4567e89b42d3a456426614174000',
      total_count: '3',
    };
    const rpc = vi.fn().mockResolvedValue({
      data: [
        olderRow,
        tiedRow,
        { ...incidentRow, total_count: '3' },
      ],
      error: null,
    });
    const api = createReportsApi({
      getClient: () => createClient(rpc),
      fetch: vi.fn() as unknown as typeof fetch,
    });

    const result = await api.listIncidents();

    expect(result.incidents.map(({ id }) => id)).toEqual([
      incident.id,
      tiedRow.id,
      olderRow.id,
    ]);
  });

  it('maps server-side global and location aggregates', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'get_public_incident_stats') {
        return {
          data: [
            {
              incidents_last_10_minutes: '7',
              active_incident_count: '11',
              affected_state_count: '3',
              bengaluru_active_count: '4',
              generated_at: '2026-08-28T10:06:00.000Z',
            },
          ],
          error: null,
        };
      }

      return {
        data: [
          {
            normalized_state: 'karnataka',
            normalized_city: 'bengaluru',
            normalized_locality: 'hsr layout',
            normalized_sector: null,
            state_label: 'Karnataka',
            city_label: 'Bengaluru',
            locality_label: 'HSR Layout',
            sector_label: null,
            incident_count: '8',
            active_incident_count: '3',
            total_count: '1',
          },
        ],
        error: null,
      };
    });
    const api = createReportsApi({
      getClient: () => createClient(rpc),
      fetch: vi.fn() as unknown as typeof fetch,
    });

    await expect(api.getAggregateStats()).resolves.toEqual({
      incidentsLast10Minutes: 7,
      activeIncidents: 11,
      affectedStates: 3,
      bengaluruActiveIncidents: 4,
      generatedAt: '2026-08-28T10:06:00.000Z',
    });
    await expect(
      api.getLocationAggregates({
        state: 'Karnataka',
        activeOnly: true,
        since: '2026-08-28T00:00:00.000Z',
        limit: 10,
      }),
    ).resolves.toMatchObject({
      aggregates: [
        {
          state: 'Karnataka',
          city: 'Bengaluru',
          locality: 'HSR Layout',
          sector: null,
          incidentCount: 8,
          activeIncidentCount: 3,
        },
      ],
      total: 1,
    });
    expect(rpc).toHaveBeenLastCalledWith('get_public_location_aggregates', {
      p_state: 'Karnataka',
      p_city: null,
      p_active_only: true,
      p_since: '2026-08-28T00:00:00.000Z',
      p_limit: 10,
      p_offset: 0,
    });
  });

  it('uses the bounded server geospatial query for nearby incidents', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ ...incidentRow, distance_km: '1.234' }],
      error: null,
    });
    const api = createReportsApi({
      getClient: () => createClient(rpc),
      fetch: vi.fn() as unknown as typeof fetch,
    });

    await expect(
      api.getNearbyIncidents({
        latitude: 12.9121,
        longitude: 77.6446,
        radiusKm: 25,
        limit: 10,
        excludeIncidentId: '223e4567-e89b-42d3-a456-426614174000',
      }),
    ).resolves.toEqual([{ incident, distanceKm: 1.23 }]);
    expect(rpc).toHaveBeenCalledWith('get_nearby_public_incidents', {
      p_latitude: 12.9121,
      p_longitude: 77.6446,
      p_radius_km: 25,
      p_limit: 10,
      p_exclude_incident_id: '223e4567-e89b-42d3-a456-426614174000',
    });
  });

  it('rejects invalid nearby radii and exclusion ids instead of clamping them', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const api = createReportsApi({
      getClient: () => createClient(rpc),
      fetch: vi.fn() as unknown as typeof fetch,
    });

    await expect(
      api.getNearbyIncidents({
        latitude: 12.9121,
        longitude: 77.6446,
        radiusKm: Number.NaN,
      }),
    ).rejects.toMatchObject({
      name: 'ReportsApiError',
      status: 400,
      code: 'VALIDATION_ERROR',
    });
    await expect(
      api.getNearbyIncidents({
        latitude: 12.9121,
        longitude: 77.6446,
        radiusKm: 500,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      api.getNearbyIncidents({
        latitude: 12.9121,
        longitude: 77.6446,
        excludeIncidentId: 'not-a-uuid',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('normalizes configuration and rejected query failures as typed errors', async () => {
    const configurationApi = createReportsApi({
      getClient: () => {
        throw new BrowserEnvironmentError();
      },
      fetch: vi.fn() as unknown as typeof fetch,
    });
    const networkApi = createReportsApi({
      getClient: () =>
        createClient(vi.fn().mockRejectedValue(new TypeError('fetch failed'))),
      fetch: vi.fn() as unknown as typeof fetch,
    });

    await expect(configurationApi.listIncidents()).rejects.toMatchObject({
      name: 'ReportsApiError',
      status: 500,
      code: 'CONFIGURATION_ERROR',
    });
    await expect(networkApi.listIncidents()).rejects.toMatchObject({
      name: 'ReportsApiError',
      status: 0,
      code: 'NETWORK_ERROR',
    });
  });
});

describe('protected incident writes', () => {
  it('creates or joins through the protected API with browser credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mutationResponse());
    const api = createReportsApi({
      getClient: () => createClient(vi.fn()),
      fetch: fetchMock as unknown as typeof fetch,
    });
    const payload: CreateOrJoinIncidentPayload = {
      turnstileToken: 'captcha-token',
      state: 'Karnataka',
      city: 'Bengaluru',
      locality: 'HSR Layout',
      pincode: '560102',
      latitude: 12.9121,
      longitude: 77.6446,
      outageType: 'unexpected',
    };

    await expect(api.createOrJoinIncident(payload)).resolves.toEqual({
      incident,
      wasCreated: true,
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/incidents', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  });

  it('decodes the actual Vercel mutation envelope, not a frontend-shaped fixture', async () => {
    const { parseIncidentMutationResult } = await import(
      '../../api/_lib/incidents'
    );
    const envelope = parseIncidentMutationResult({
      id: incidentRow.id,
      slug: incidentRow.slug,
      normalized_state: incidentRow.normalized_state,
      normalized_city: incidentRow.normalized_city,
      normalized_locality: incidentRow.normalized_locality,
      normalized_sector: incidentRow.normalized_sector,
      state_label: incidentRow.state_label,
      city_label: incidentRow.city_label,
      locality_label: incidentRow.locality_label,
      sector_label: incidentRow.sector_label,
      pincode: incidentRow.pincode,
      latitude: incidentRow.latitude,
      longitude: incidentRow.longitude,
      outage_type: incidentRow.outage_type,
      consensus_status: incidentRow.consensus_status,
      participant_count: 4,
      out_count: 3,
      back_count: 1,
      out_percentage: 75,
      back_percentage: 25,
      created_at: incidentRow.created_at,
      updated_at: incidentRow.updated_at,
      last_activity_at: incidentRow.last_activity_at,
      inactive_at: null,
      was_created: true,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: envelope }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const api = createReportsApi({
      getClient: () => createClient(vi.fn()),
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      api.createOrJoinIncident({
        turnstileToken: 'captcha-token',
        state: 'Karnataka',
        city: 'Bengaluru',
        locality: 'HSR Layout',
        latitude: 12.9121,
        longitude: 77.6446,
        outageType: 'unexpected',
      }),
    ).resolves.toEqual({ incident, wasCreated: true });
  });

  it('submits observations through the protected API with browser credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mutationResponse(false));
    const api = createReportsApi({
      getClient: () => createClient(vi.fn()),
      fetch: fetchMock as unknown as typeof fetch,
    });
    const payload: SubmitObservationPayload = {
      turnstileToken: 'captcha-token',
      incidentId: incident.id,
      state: 'back',
    };

    await expect(api.submitObservation(payload)).resolves.toEqual({
      incident,
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/observations', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  });

  it('decodes structured API errors without losing status or details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many observations',
            details: { retryAfterSeconds: 42 },
          },
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const api = createReportsApi({
      getClient: () => createClient(vi.fn()),
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      api.submitObservation({
        turnstileToken: 'captcha-token',
        incidentId: incident.id,
        state: 'out',
      }),
    ).rejects.toMatchObject({
      name: 'ReportsApiError',
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many observations',
      details: { retryAfterSeconds: 42 },
    });
  });
});

describe('incident realtime updates', () => {
  it('debounces refreshes and removes the channel and timer on cleanup', async () => {
    vi.useFakeTimers();
    const channel = {
      on: vi.fn(),
      subscribe: vi.fn(),
    };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const removeChannel = vi.fn().mockResolvedValue('ok');
    const client = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel,
    } as unknown as BrowserSupabaseClient;
    const api = createReportsApi({
      getClient: () => client,
      fetch: vi.fn() as unknown as typeof fetch,
    });
    const refresh = vi.fn().mockResolvedValue(undefined);

    const unsubscribe = api.subscribeToIncidentChanges(refresh, {
      debounceMs: 50,
    });
    const changeHandler = channel.on.mock.calls[0]?.[2] as
      | (() => void)
      | undefined;

    changeHandler?.();
    changeHandler?.();
    await vi.advanceTimersByTimeAsync(49);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    changeHandler?.();
    unsubscribe();
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });

  it('reports synchronous refresh failures without leaking timer errors', async () => {
    vi.useFakeTimers();
    const channel = {
      on: vi.fn(),
      subscribe: vi.fn(),
    };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const client = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn().mockResolvedValue('ok'),
    } as unknown as BrowserSupabaseClient;
    const api = createReportsApi({
      getClient: () => client,
      fetch: vi.fn() as unknown as typeof fetch,
    });
    const onError = vi.fn();
    const unsubscribe = api.subscribeToIncidentChanges(
      () => {
        throw new Error('refresh failed');
      },
      { debounceMs: 0, onError },
    );
    const changeHandler = channel.on.mock.calls[0]?.[2] as
      | (() => void)
      | undefined;

    changeHandler?.();
    await vi.runAllTimersAsync();

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'refresh failed' }),
    );
    unsubscribe();
  });

  it('coalesces in-flight refreshes and ignores late unsubscribe errors', async () => {
    vi.useFakeTimers();
    const channel = {
      on: vi.fn(),
      subscribe: vi.fn(),
    };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const onError = vi.fn();
    let resolveRefresh: (() => void) | undefined;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const removeChannel = vi.fn().mockResolvedValue('timed out');
    const client = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel,
    } as unknown as BrowserSupabaseClient;
    const api = createReportsApi({
      getClient: () => client,
      fetch: vi.fn() as unknown as typeof fetch,
    });
    const unsubscribe = api.subscribeToIncidentChanges(refresh, {
      debounceMs: 0,
      onError,
    });
    const changeHandler = channel.on.mock.calls[0]?.[2] as
      | (() => void)
      | undefined;

    changeHandler?.();
    await vi.runAllTimersAsync();
    changeHandler?.();
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(1);

    resolveRefresh?.();
    await Promise.resolve();
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(2);

    unsubscribe();
    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
  });
});
