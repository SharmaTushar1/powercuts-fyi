import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AggregateStats,
  CreateOrJoinIncidentPayload,
  CreateOrJoinIncidentResult,
  Incident,
  IncidentListQuery,
  IncidentListResult,
  LocationAggregate,
  LocationAggregateQuery,
  LocationAggregateResult,
  NearbyIncident,
  NearbyIncidentQuery,
  NewReportInput,
  ObservationResult,
  ObservationState,
  Report,
  SubmitObservationPayload,
} from '../types';
import {
  reportsApi,
  ReportsApiError,
  toCompatibilityReport,
  type ReportsApi,
} from '../lib/reportsApi';

export interface MutationPendingState {
  createOrJoin: boolean;
  observations: Readonly<Record<string, ObservationState>>;
}

export interface ReportsContextValue {
  incidents: Incident[];
  reports: Report[];
  aggregateStats: AggregateStats | null;
  locationAggregates: LocationAggregate[];
  loading: boolean;
  pending: MutationPendingState;
  error: ReportsApiError | null;
  refresh: () => Promise<void>;
  clearError: () => void;
  createOrJoinIncident: (
    payload: CreateOrJoinIncidentPayload,
  ) => Promise<CreateOrJoinIncidentResult>;
  submitObservation: (
    payload: SubmitObservationPayload,
  ) => Promise<ObservationResult>;
  fetchIncidentBySlug: (slug: string) => Promise<Incident | null>;
  fetchAggregateStats: () => Promise<AggregateStats>;
  fetchLocationAggregates: (
    query?: LocationAggregateQuery,
  ) => Promise<LocationAggregateResult>;
  fetchNearbyIncidents: (
    query: NearbyIncidentQuery,
  ) => Promise<NearbyIncident[]>;
  fetchIncidents: (query?: IncidentListQuery) => Promise<IncidentListResult>;
  /**
   * Transitional Task 2 aliases retained for the pre-Task 3 components.
   */
  confirm: (id: string, turnstileToken?: string) => Promise<void>;
  resolve: (id: string, turnstileToken?: string) => Promise<void>;
  report: (input: NewReportInput) => Promise<Report>;
}

interface ReportsProviderProps {
  children: ReactNode;
  api?: ReportsApi;
}

const ReportsContext = createContext<ReportsContextValue | null>(null);

function toReportsApiError(error: unknown): ReportsApiError {
  if (error instanceof ReportsApiError) {
    return error;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return new ReportsApiError(500, 'INTERNAL_ERROR', error.message, {
      cause: error,
    });
  }
  return new ReportsApiError(
    500,
    'INTERNAL_ERROR',
    'An unexpected incident service error occurred',
    { cause: error },
  );
}

function startOfLocalDayIso(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function compareByActivity(left: Incident, right: Incident): number {
  const activityDifference =
    Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt);
  return activityDifference !== 0
    ? activityDifference
    : left.id.localeCompare(right.id);
}

function compareFreshness(left: Incident, right: Incident): number {
  const activityDifference =
    Date.parse(left.lastActivityAt) - Date.parse(right.lastActivityAt);
  if (activityDifference !== 0) {
    return activityDifference;
  }
  return Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
}

function sortByActivity(incidents: readonly Incident[]): Incident[] {
  return [...incidents].sort(compareByActivity);
}

function overlayMutatedIncidents(
  refreshed: readonly Incident[],
  current: readonly Incident[],
  mutatedIds: ReadonlySet<string>,
): Incident[] {
  const merged = new Map(refreshed.map((incident) => [incident.id, incident]));
  for (const id of mutatedIds) {
    const currentIncident = current.find((incident) => incident.id === id);
    if (!currentIncident) {
      continue;
    }
    const refreshedIncident = merged.get(id);
    if (
      !refreshedIncident ||
      compareFreshness(currentIncident, refreshedIncident) > 0
    ) {
      merged.set(id, currentIncident);
    }
  }
  return sortByActivity([...merged.values()]);
}

export function ReportsProvider({
  children,
  api = reportsApi,
}: ReportsProviderProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [aggregateStats, setAggregateStats] =
    useState<AggregateStats | null>(null);
  const [locationAggregates, setLocationAggregates] = useState<
    LocationAggregate[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReportsApiError | null>(null);
  const [pending, setPending] = useState<MutationPendingState>({
    createOrJoin: false,
    observations: {},
  });
  const mountedRef = useRef(false);
  const refreshSequenceRef = useRef(0);
  const incidentRevisionRef = useRef(0);
  const aggregateSequenceRef = useRef(0);
  const locationSequenceRef = useRef(0);
  const createPendingCountRef = useRef(0);
  const observationRequestSequenceRef = useRef(0);
  const observationPendingRef = useRef(
    new Map<string, Map<number, ObservationState>>(),
  );
  const mutatedIdsRef = useRef(new Set<string>());
  const errorGenerationRef = useRef(0);

  const surfaceError = useCallback((caught: unknown): ReportsApiError => {
    const nextError = toReportsApiError(caught);
    errorGenerationRef.current += 1;
    if (mountedRef.current) {
      setError(nextError);
    }
    return nextError;
  }, []);

  const clearErrorIfCurrent = useCallback((generation: number): void => {
    if (mountedRef.current && generation === errorGenerationRef.current) {
      setError(null);
    }
  }, []);

  const upsertIncident = useCallback((incident: Incident): void => {
    if (!mountedRef.current) {
      return;
    }
    incidentRevisionRef.current += 1;
    mutatedIdsRef.current.add(incident.id);
    setIncidents((current) => {
      const existing = current.find((item) => item.id === incident.id);
      if (existing && compareFreshness(existing, incident) > 0) {
        return current;
      }
      return sortByActivity([
        incident,
        ...current.filter((item) => item.id !== incident.id),
      ]);
    });
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const sequence = ++refreshSequenceRef.current;
    const incidentRevision = incidentRevisionRef.current;
    const aggregateSequence = ++aggregateSequenceRef.current;
    const locationSequence = ++locationSequenceRef.current;
    const errorGeneration = errorGenerationRef.current;
    if (mountedRef.current) {
      setLoading(true);
    }

    try {
      const [incidentResult, statsResult, locationResult] = await Promise.all([
        api.listIncidents(),
        api.getAggregateStats(),
        api.getLocationAggregates({ since: startOfLocalDayIso() }),
      ]);
      if (
        mountedRef.current &&
        sequence === refreshSequenceRef.current
      ) {
        setIncidents((current) => {
          if (incidentRevision === incidentRevisionRef.current) {
            mutatedIdsRef.current.clear();
            return sortByActivity(incidentResult.incidents);
          }
          return overlayMutatedIncidents(
            incidentResult.incidents,
            current,
            mutatedIdsRef.current,
          );
        });
        if (aggregateSequence === aggregateSequenceRef.current) {
          setAggregateStats(statsResult);
        }
        if (locationSequence === locationSequenceRef.current) {
          setLocationAggregates(locationResult.aggregates);
        }
        clearErrorIfCurrent(errorGeneration);
      }
    } catch (caught) {
      if (
        mountedRef.current &&
        sequence === refreshSequenceRef.current
      ) {
        surfaceError(caught);
      }
      throw caught;
    } finally {
      if (
        mountedRef.current &&
        sequence === refreshSequenceRef.current
      ) {
        setLoading(false);
      }
    }
  }, [api, clearErrorIfCurrent, surfaceError]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh().catch(() => {
      // refresh stores the user-visible error before rejecting.
    });

    let unsubscribe = (): void => undefined;
    try {
      unsubscribe = api.subscribeToIncidentChanges(refresh, {
        onError: surfaceError,
      });
    } catch (caught) {
      surfaceError(caught);
    }

    return () => {
      mountedRef.current = false;
      refreshSequenceRef.current += 1;
      aggregateSequenceRef.current += 1;
      locationSequenceRef.current += 1;
      unsubscribe();
    };
  }, [api, refresh, surfaceError]);

  const clearError = useCallback((): void => {
    if (mountedRef.current) {
      setError(null);
    }
  }, []);

  const refreshAggregateState = useCallback(async (): Promise<void> => {
    const aggregateSequence = ++aggregateSequenceRef.current;
    const locationSequence = ++locationSequenceRef.current;
    try {
      const [statsResult, locationResult] = await Promise.all([
        api.getAggregateStats(),
        api.getLocationAggregates({ since: startOfLocalDayIso() }),
      ]);
      if (!mountedRef.current) {
        return;
      }
      if (aggregateSequence === aggregateSequenceRef.current) {
        setAggregateStats(statsResult);
      }
      if (locationSequence === locationSequenceRef.current) {
        setLocationAggregates(locationResult.aggregates);
      }
    } catch (caught) {
      if (
        aggregateSequence === aggregateSequenceRef.current &&
        locationSequence === locationSequenceRef.current
      ) {
        surfaceError(caught);
      }
    }
  }, [api, surfaceError]);

  const createOrJoinIncident = useCallback(
    async (
      payload: CreateOrJoinIncidentPayload,
    ): Promise<CreateOrJoinIncidentResult> => {
      createPendingCountRef.current += 1;
      const errorGeneration = errorGenerationRef.current;
      if (mountedRef.current) {
        setPending((current) => ({ ...current, createOrJoin: true }));
      }

      try {
        const result = await api.createOrJoinIncident(payload);
        upsertIncident(result.incident);
        if (mountedRef.current) {
          await refreshAggregateState();
          clearErrorIfCurrent(errorGeneration);
        }
        return result;
      } catch (caught) {
        surfaceError(caught);
        throw caught;
      } finally {
        createPendingCountRef.current = Math.max(
          createPendingCountRef.current - 1,
          0,
        );
        if (mountedRef.current) {
          const stillPending = createPendingCountRef.current > 0;
          setPending((current) => ({
            ...current,
            createOrJoin: stillPending,
          }));
        }
      }
    },
    [api, clearErrorIfCurrent, refreshAggregateState, surfaceError, upsertIncident],
  );

  const submitObservation = useCallback(
    async (
      payload: SubmitObservationPayload,
    ): Promise<ObservationResult> => {
      const requestSequence = ++observationRequestSequenceRef.current;
      const errorGeneration = errorGenerationRef.current;
      const incidentPending =
        observationPendingRef.current.get(payload.incidentId) ?? new Map();
      incidentPending.set(requestSequence, payload.state);
      observationPendingRef.current.set(payload.incidentId, incidentPending);
      if (mountedRef.current) {
        setPending((current) => ({
          ...current,
          observations: {
            ...current.observations,
            [payload.incidentId]: payload.state,
          },
        }));
      }

      try {
        const result = await api.submitObservation(payload);
        upsertIncident(result.incident);
        if (mountedRef.current) {
          await refreshAggregateState();
          clearErrorIfCurrent(errorGeneration);
        }
        return result;
      } catch (caught) {
        surfaceError(caught);
        throw caught;
      } finally {
        const pendingForIncident = observationPendingRef.current.get(
          payload.incidentId,
        );
        pendingForIncident?.delete(requestSequence);
        if (pendingForIncident?.size === 0) {
          observationPendingRef.current.delete(payload.incidentId);
        }

        if (mountedRef.current) {
          setPending((current) => {
            const observations = { ...current.observations };
            const remainingRequests = observationPendingRef.current.get(
              payload.incidentId,
            );
            const remaining = remainingRequests
              ? [...remainingRequests.values()].at(-1)
              : undefined;
            if (remaining !== undefined) {
              observations[payload.incidentId] = remaining;
            } else {
              delete observations[payload.incidentId];
            }
            return { ...current, observations };
          });
        }
      }
    },
    [api, clearErrorIfCurrent, refreshAggregateState, surfaceError, upsertIncident],
  );

  const fetchIncidentBySlug = useCallback(
    async (slug: string): Promise<Incident | null> => {
      const errorGeneration = errorGenerationRef.current;
      try {
        const incident = await api.getIncidentBySlug(slug);
        if (incident) {
          upsertIncident(incident);
        }
        clearErrorIfCurrent(errorGeneration);
        return incident;
      } catch (caught) {
        surfaceError(caught);
        throw caught;
      }
    },
    [api, clearErrorIfCurrent, surfaceError, upsertIncident],
  );

  const fetchAggregateStats = useCallback(async (): Promise<AggregateStats> => {
    const sequence = ++aggregateSequenceRef.current;
    const errorGeneration = errorGenerationRef.current;
    try {
      const result = await api.getAggregateStats();
      if (
        mountedRef.current &&
        sequence === aggregateSequenceRef.current
      ) {
        setAggregateStats(result);
        clearErrorIfCurrent(errorGeneration);
      }
      return result;
    } catch (caught) {
      if (sequence === aggregateSequenceRef.current) {
        surfaceError(caught);
      }
      throw caught;
    }
  }, [api, clearErrorIfCurrent, surfaceError]);

  const fetchLocationAggregates = useCallback(
    async (
      query: LocationAggregateQuery = {},
    ): Promise<LocationAggregateResult> => {
      const sequence = ++locationSequenceRef.current;
      const errorGeneration = errorGenerationRef.current;
      try {
        const result = await api.getLocationAggregates({
          ...query,
          since: query.since ?? startOfLocalDayIso(),
        });
        if (
          mountedRef.current &&
          sequence === locationSequenceRef.current
        ) {
          setLocationAggregates(result.aggregates);
          clearErrorIfCurrent(errorGeneration);
        }
        return result;
      } catch (caught) {
        if (sequence === locationSequenceRef.current) {
          surfaceError(caught);
        }
        throw caught;
      }
    },
    [api, clearErrorIfCurrent, surfaceError],
  );

  const fetchNearbyIncidents = useCallback(
    async (query: NearbyIncidentQuery): Promise<NearbyIncident[]> => {
      const errorGeneration = errorGenerationRef.current;
      try {
        const result = await api.getNearbyIncidents(query);
        clearErrorIfCurrent(errorGeneration);
        return result;
      } catch (caught) {
        surfaceError(caught);
        throw caught;
      }
    },
    [api, clearErrorIfCurrent, surfaceError],
  );

  const fetchIncidents = useCallback(
    async (query: IncidentListQuery = {}): Promise<IncidentListResult> => {
      const errorGeneration = errorGenerationRef.current;
      try {
        const result = await api.listIncidents(query);
        clearErrorIfCurrent(errorGeneration);
        return result;
      } catch (caught) {
        surfaceError(caught);
        throw caught;
      }
    },
    [api, clearErrorIfCurrent, surfaceError],
  );

  const confirm = useCallback(
    async (id: string, turnstileToken?: string): Promise<void> => {
      if (!turnstileToken) {
        const caught = new ReportsApiError(
          400,
          'VALIDATION_ERROR',
          'Complete verification before submitting an observation',
        );
        surfaceError(caught);
        throw caught;
      }
      await submitObservation({
        incidentId: id,
        state: 'out',
        turnstileToken,
      });
    },
    [submitObservation, surfaceError],
  );

  const resolve = useCallback(
    async (id: string, turnstileToken?: string): Promise<void> => {
      if (!turnstileToken) {
        const caught = new ReportsApiError(
          400,
          'VALIDATION_ERROR',
          'Complete verification before submitting an observation',
        );
        surfaceError(caught);
        throw caught;
      }
      await submitObservation({
        incidentId: id,
        state: 'back',
        turnstileToken,
      });
    },
    [submitObservation, surfaceError],
  );

  const report = useCallback(
    async (input: NewReportInput): Promise<Report> => {
      if (
        input.latitude === undefined ||
        input.longitude === undefined ||
        input.turnstileToken === undefined
      ) {
        const caught = new ReportsApiError(
          400,
          'VALIDATION_ERROR',
          'Complete location and verification before reporting an incident',
        );
        surfaceError(caught);
        throw caught;
      }

      const result = await createOrJoinIncident({
        turnstileToken: input.turnstileToken,
        state: input.state,
        city: input.city,
        locality: input.locality,
        ...(input.sector === undefined ? {} : { sector: input.sector }),
        ...(input.pincode === undefined ? {} : { pincode: input.pincode }),
        latitude: input.latitude,
        longitude: input.longitude,
        outageType: input.type,
      });
      return toCompatibilityReport(result.incident);
    },
    [createOrJoinIncident, surfaceError],
  );

  const reports = useMemo(
    () => incidents.map(toCompatibilityReport),
    [incidents],
  );
  const value = useMemo<ReportsContextValue>(
    () => ({
      incidents,
      reports,
      aggregateStats,
      locationAggregates,
      loading,
      pending,
      error,
      refresh,
      clearError,
      createOrJoinIncident,
      submitObservation,
      fetchIncidentBySlug,
      fetchAggregateStats,
      fetchLocationAggregates,
      fetchNearbyIncidents,
      fetchIncidents,
      confirm,
      resolve,
      report,
    }),
    [
      incidents,
      reports,
      aggregateStats,
      locationAggregates,
      loading,
      pending,
      error,
      refresh,
      clearError,
      createOrJoinIncident,
      submitObservation,
      fetchIncidentBySlug,
      fetchAggregateStats,
      fetchLocationAggregates,
      fetchNearbyIncidents,
      fetchIncidents,
      confirm,
      resolve,
      report,
    ],
  );

  return (
    <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
  );
}

export function useReports(): ReportsContextValue {
  const context = useContext(ReportsContext);
  if (!context) {
    throw new Error('useReports must be used within a ReportsProvider');
  }
  return context;
}
