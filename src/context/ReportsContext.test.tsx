// @vitest-environment jsdom

import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ReportsProvider,
  type ReportsContextValue,
  useReports,
} from './ReportsContext';
import type { ReportsApi } from '../lib/reportsApi';
import type {
  AggregateStats,
  Incident,
  IncidentListResult,
  CreateOrJoinIncidentResult,
  LocationAggregateResult,
  ObservationResult,
} from '../types';

const incident: Incident = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  slug: 'pc-123e4567e89b42d3a456426614174000',
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
    participantCount: 2,
    outCount: 2,
    backCount: 0,
    outPercentage: 100,
    backPercentage: 0,
  },
  createdAt: '2026-08-28T10:00:00.000Z',
  updatedAt: '2026-08-28T10:05:00.000Z',
  lastActivityAt: '2026-08-28T10:05:00.000Z',
  inactiveAt: null,
};

const resolvedIncident: Incident = {
  ...incident,
  status: 'resolved',
  consensus: {
    participantCount: 3,
    outCount: 1,
    backCount: 2,
    outPercentage: 33.33,
    backPercentage: 66.67,
  },
  updatedAt: '2026-08-28T10:10:00.000Z',
  lastActivityAt: '2026-08-28T10:10:00.000Z',
};

const stats: AggregateStats = {
  incidentsLast10Minutes: 1,
  activeIncidents: 1,
  affectedStates: 1,
  bengaluruActiveIncidents: 1,
  generatedAt: '2026-08-28T10:06:00.000Z',
};

const locations: LocationAggregateResult = {
  aggregates: [],
  total: 0,
  limit: 500,
  offset: 0,
  hasMore: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createApi(overrides: Partial<ReportsApi> = {}): ReportsApi {
  return {
    listIncidents: vi.fn().mockResolvedValue({
      incidents: [incident],
      total: 1,
      limit: 50,
      offset: 0,
      hasMore: false,
    }),
    getIncidentBySlug: vi.fn().mockResolvedValue(incident),
    getAggregateStats: vi.fn().mockResolvedValue(stats),
    getLocationAggregates: vi.fn().mockResolvedValue(locations),
    getNearbyIncidents: vi.fn().mockResolvedValue([]),
    createOrJoinIncident: vi.fn().mockResolvedValue({
      incident,
      wasCreated: true,
    }),
    submitObservation: vi.fn().mockResolvedValue({ incident }),
    subscribeToIncidentChanges: vi.fn().mockReturnValue(() => undefined),
    ...overrides,
  };
}

function Probe({
  onValue,
}: {
  onValue: (value: ReportsContextValue) => void;
}) {
  const value = useReports();

  useEffect(() => {
    onValue(value);
  }, [onValue, value]);

  return null;
}

describe('ReportsProvider', () => {
  it('surfaces an initial read error and clears it after a successful refresh', async () => {
    const listIncidents = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({
        incidents: [incident],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      })
      .mockRejectedValueOnce(new Error('Refresh unavailable'));
    const values: ReportsContextValue[] = [];

    render(
      <ReportsProvider api={createApi({ listIncidents })}>
        <Probe onValue={(value) => values.push(value)} />
      </ReportsProvider>,
    );

    await waitFor(() => {
      expect(values.at(-1)?.error?.message).toBe('Network unavailable');
      expect(values.at(-1)?.loading).toBe(false);
    });

    await act(async () => {
      await values.at(-1)?.refresh();
    });

    await waitFor(() => {
      expect(values.at(-1)?.error).toBeNull();
      expect(values.at(-1)?.incidents).toEqual([incident]);
    });

    await act(async () => {
      await expect(values.at(-1)?.refresh()).rejects.toThrow(
        'Refresh unavailable',
      );
    });
    expect(values.at(-1)?.incidents).toEqual([incident]);
    expect(values.at(-1)?.error?.message).toBe('Refresh unavailable');
  });

  it('cleans up realtime subscriptions when the provider unmounts', async () => {
    const cleanup = vi.fn();
    const subscribeToIncidentChanges = vi.fn().mockReturnValue(cleanup);
    const values: ReportsContextValue[] = [];
    const { unmount } = render(
      <ReportsProvider api={createApi({ subscribeToIncidentChanges })}>
        <Probe onValue={(value) => values.push(value)} />
      </ReportsProvider>,
    );

    await waitFor(() => {
      expect(values.at(-1)?.loading).toBe(false);
      expect(subscribeToIncidentChanges).toHaveBeenCalledTimes(1);
    });

    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('tracks create and observation mutations independently', async () => {
    let completeCreate: ((value: CreateOrJoinIncidentResult) => void) | undefined;
    let completeObservation:
      | ((value: ObservationResult) => void)
      | undefined;
    const createOrJoinIncident = vi.fn(
      () =>
        new Promise<CreateOrJoinIncidentResult>((resolve) => {
          completeCreate = resolve;
        }),
    );
    const submitObservation = vi.fn(
      () =>
        new Promise<ObservationResult>((resolve) => {
          completeObservation = resolve;
        }),
    );
    const values: ReportsContextValue[] = [];
    render(
      <ReportsProvider
        api={createApi({ createOrJoinIncident, submitObservation })}
      >
        <Probe onValue={(value) => values.push(value)} />
      </ReportsProvider>,
    );
    await waitFor(() => expect(values.at(-1)?.loading).toBe(false));

    let mutation: Promise<CreateOrJoinIncidentResult> | undefined;
    let observation: Promise<ObservationResult> | undefined;
    act(() => {
      mutation = values.at(-1)?.createOrJoinIncident({
        turnstileToken: 'captcha-token',
        state: 'Karnataka',
        city: 'Bengaluru',
        locality: 'HSR Layout',
        pincode: '560102',
        latitude: 12.9121,
        longitude: 77.6446,
        outageType: 'unexpected',
      });
      observation = values.at(-1)?.submitObservation({
        turnstileToken: 'captcha-token',
        incidentId: incident.id,
        state: 'back',
      });
    });

    await waitFor(() =>
      expect(values.at(-1)?.pending.createOrJoin).toBe(true),
    );
    expect(values.at(-1)?.pending.observations).toEqual({
      [incident.id]: 'back',
    });

    await act(async () => {
      completeCreate?.({ incident, wasCreated: true });
      await mutation;
    });

    expect(values.at(-1)?.pending.createOrJoin).toBe(false);
    expect(values.at(-1)?.pending.observations).toEqual({
      [incident.id]: 'back',
    });

    await act(async () => {
      completeObservation?.({ incident });
      await observation;
    });

    expect(values.at(-1)?.pending.observations).toEqual({});
  });

  it('keeps a newer mutation result when an older refresh finishes later', async () => {
    let completeRefresh:
      | ((value: IncidentListResult) => void)
      | undefined;
    const staleRefresh = new Promise<IncidentListResult>((resolve) => {
      completeRefresh = resolve;
    });
    const listIncidents = vi
      .fn()
      .mockResolvedValueOnce({
        incidents: [incident],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      })
      .mockReturnValueOnce(staleRefresh);
    const submitObservation = vi.fn().mockResolvedValue({
      incident: resolvedIncident,
    });
    const values: ReportsContextValue[] = [];
    render(
      <ReportsProvider
        api={createApi({ listIncidents, submitObservation })}
      >
        <Probe onValue={(value) => values.push(value)} />
      </ReportsProvider>,
    );
    await waitFor(() => expect(values.at(-1)?.loading).toBe(false));

    let refreshPromise: Promise<void> | undefined;
    act(() => {
      refreshPromise = values.at(-1)?.refresh();
    });
    await waitFor(() => expect(listIncidents).toHaveBeenCalledTimes(2));

    await act(async () => {
      await values.at(-1)?.submitObservation({
        turnstileToken: 'captcha-token',
        incidentId: incident.id,
        state: 'back',
      });
    });
    expect(values.at(-1)?.incidents).toEqual([resolvedIncident]);

    await act(async () => {
      completeRefresh?.({
        incidents: [incident],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      });
      await refreshPromise;
    });

    expect(values.at(-1)?.incidents).toEqual([resolvedIncident]);
  });

  it('refreshes aggregate state after a successful observation', async () => {
    const updatedStats: AggregateStats = {
      ...stats,
      activeIncidents: 0,
      generatedAt: '2026-08-28T10:11:00.000Z',
    };
    const getAggregateStats = vi
      .fn()
      .mockResolvedValueOnce(stats)
      .mockResolvedValueOnce(updatedStats);
    const getLocationAggregates = vi
      .fn()
      .mockResolvedValueOnce(locations)
      .mockResolvedValueOnce(locations);
    const values: ReportsContextValue[] = [];
    render(
      <ReportsProvider
        api={createApi({
          getAggregateStats,
          getLocationAggregates,
          submitObservation: vi.fn().mockResolvedValue({
            incident: resolvedIncident,
          }),
        })}
      >
        <Probe onValue={(value) => values.push(value)} />
      </ReportsProvider>,
    );
    await waitFor(() => expect(values.at(-1)?.loading).toBe(false));

    await act(async () => {
      await values.at(-1)?.submitObservation({
        turnstileToken: 'captcha-token',
        incidentId: incident.id,
        state: 'back',
      });
    });

    expect(values.at(-1)?.aggregateStats).toEqual(updatedStats);
    expect(getAggregateStats).toHaveBeenCalledTimes(2);
    expect(getLocationAggregates).toHaveBeenCalledTimes(2);
  });

  it('ignores an older aggregate error after a newer request succeeds', async () => {
    let rejectOlder: ((reason?: unknown) => void) | undefined;
    const olderRequest = new Promise<AggregateStats>((_resolve, reject) => {
      rejectOlder = reject;
    });
    const updatedStats: AggregateStats = {
      ...stats,
      activeIncidents: 2,
      generatedAt: '2026-08-28T10:12:00.000Z',
    };
    const getAggregateStats = vi
      .fn()
      .mockResolvedValueOnce(stats)
      .mockReturnValueOnce(olderRequest)
      .mockResolvedValueOnce(updatedStats);
    const values: ReportsContextValue[] = [];
    render(
      <ReportsProvider api={createApi({ getAggregateStats })}>
        <Probe onValue={(value) => values.push(value)} />
      </ReportsProvider>,
    );
    await waitFor(() => expect(values.at(-1)?.loading).toBe(false));

    let olderResult: Promise<AggregateStats | undefined> | undefined;
    act(() => {
      olderResult = values
        .at(-1)
        ?.fetchAggregateStats()
        .catch(() => undefined);
    });
    await waitFor(() => expect(getAggregateStats).toHaveBeenCalledTimes(2));

    await act(async () => {
      await values.at(-1)?.fetchAggregateStats();
    });
    expect(values.at(-1)?.aggregateStats).toEqual(updatedStats);
    expect(values.at(-1)?.error).toBeNull();

    await act(async () => {
      rejectOlder?.(new Error('Stale aggregate failure'));
      await olderResult;
    });

    expect(values.at(-1)?.aggregateStats).toEqual(updatedStats);
    expect(values.at(-1)?.error).toBeNull();
  });

  it('does not clear a newer error when an older full refresh succeeds', async () => {
    const listRefresh = deferred<IncidentListResult>();
    const statsRefresh = deferred<AggregateStats>();
    const locationRefresh = deferred<LocationAggregateResult>();
    const listIncidents = vi
      .fn()
      .mockResolvedValueOnce({
        incidents: [incident],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      })
      .mockReturnValueOnce(listRefresh.promise);
    const getAggregateStats = vi
      .fn()
      .mockResolvedValueOnce(stats)
      .mockReturnValueOnce(statsRefresh.promise)
      .mockRejectedValueOnce(new Error('Newer aggregate failure'));
    const getLocationAggregates = vi
      .fn()
      .mockResolvedValueOnce(locations)
      .mockReturnValueOnce(locationRefresh.promise);
    const values: ReportsContextValue[] = [];
    render(
      <ReportsProvider
        api={createApi({
          listIncidents,
          getAggregateStats,
          getLocationAggregates,
        })}
      >
        <Probe onValue={(value) => values.push(value)} />
      </ReportsProvider>,
    );
    await waitFor(() => expect(values.at(-1)?.loading).toBe(false));

    let refreshPromise: Promise<void> | undefined;
    act(() => {
      refreshPromise = values.at(-1)?.refresh();
    });
    await waitFor(() => expect(listIncidents).toHaveBeenCalledTimes(2));

    await act(async () => {
      await expect(values.at(-1)?.fetchAggregateStats()).rejects.toThrow(
        'Newer aggregate failure',
      );
    });
    expect(values.at(-1)?.error?.message).toBe('Newer aggregate failure');

    await act(async () => {
      listRefresh.resolve({
        incidents: [incident],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      });
      statsRefresh.resolve(stats);
      locationRefresh.resolve(locations);
      await refreshPromise;
    });

    expect(values.at(-1)?.error?.message).toBe('Newer aggregate failure');
  });
});
