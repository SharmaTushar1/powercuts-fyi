import { z } from 'zod';
import type { BrowserSupabaseClient } from './supabase';
import { getBrowserSupabaseClient } from './supabase';
import { BrowserEnvironmentError } from './env';
import type {
  AggregateStats,
  CreateOrJoinIncidentPayload,
  CreateOrJoinIncidentResult,
  Incident,
  IncidentListQuery,
  IncidentListResult,
  LocationAggregateQuery,
  LocationAggregateResult,
  NearbyIncident,
  NearbyIncidentQuery,
  NewReportInput,
  ObservationResult,
  Report,
  ReportsErrorCode,
  SubmitObservationPayload,
} from '../types';

const PUBLIC_API_ERROR_CODES = [
  'CAPTCHA_FAILED',
  'CONFLICT',
  'INTERNAL_ERROR',
  'METHOD_NOT_ALLOWED',
  'NOT_FOUND',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'UNAUTHORIZED',
  'VALIDATION_ERROR',
] as const;

const DEFAULT_INCIDENT_LIMIT = 50;
const MAX_INCIDENT_LIMIT = 100;
const DEFAULT_LOCATION_LIMIT = 500;
const MAX_LOCATION_LIMIT = 500;
const MAX_OFFSET = 10_000;
const DEFAULT_NEARBY_RADIUS_KM = 25;
const MAX_NEARBY_RADIUS_KM = 200;
const DEFAULT_NEARBY_LIMIT = 10;
// Mirrors the clamp in get_nearby_public_incidents (supabase/migrations).
const MAX_NEARBY_LIMIT = 200;

const databaseNumberSchema = z
  .union([z.number(), z.string().trim().min(1)])
  .transform((value) => (typeof value === 'number' ? value : Number(value)))
  .pipe(z.number().finite());

const databaseNonnegativeIntegerSchema = databaseNumberSchema.pipe(
  z.number().int().nonnegative(),
);

const databasePercentageSchema = databaseNumberSchema.pipe(
  z.number().min(0).max(100),
);

const consensusSchema = z.object({
  participantCount: z.number().int().nonnegative(),
  outCount: z.number().int().nonnegative(),
  backCount: z.number().int().nonnegative(),
  outPercentage: z.number().finite().min(0).max(100),
  backPercentage: z.number().finite().min(0).max(100),
});

const SLUG_PATTERN = /^pc-[a-f0-9]{32}$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const incidentSchema = z.object({
  id: z.uuid(),
  slug: z.string().regex(SLUG_PATTERN),
  location: z.object({
    normalizedState: z.string().min(1).max(100),
    normalizedCity: z.string().min(1).max(100),
    normalizedLocality: z.string().min(1).max(100),
    normalizedSector: z.string().min(1).max(100).nullable(),
    state: z.string().min(1).max(100).optional(),
    city: z.string().min(1).max(100).optional(),
    locality: z.string().min(1).max(100).optional(),
    sector: z.string().min(1).max(100).nullable().optional(),
    stateLabel: z.string().min(1).max(100).optional(),
    cityLabel: z.string().min(1).max(100).optional(),
    localityLabel: z.string().min(1).max(100).optional(),
    sectorLabel: z.string().min(1).max(100).nullable().optional(),
    pincode: z.string().regex(/^\d{6}$/u).nullable(),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }),
  outageType: z.enum(['planned', 'unexpected']),
  status: z.enum(['ongoing', 'resolved']),
  consensus: consensusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  lastActivityAt: z.iso.datetime({ offset: true }),
  inactiveAt: z.iso.datetime({ offset: true }).nullable(),
});

const incidentRowSchema = z.object({
  id: z.uuid(),
  slug: z.string().regex(/^pc-[a-f0-9]{32}$/u),
  normalized_state: z.string().min(1).max(100),
  normalized_city: z.string().min(1).max(100),
  normalized_locality: z.string().min(1).max(100),
  normalized_sector: z.string().min(1).max(100).nullable(),
  state_label: z.string().min(1).max(100),
  city_label: z.string().min(1).max(100),
  locality_label: z.string().min(1).max(100),
  sector_label: z.string().min(1).max(100).nullable(),
  pincode: z.string().regex(/^\d{6}$/u).nullable(),
  latitude: databaseNumberSchema.pipe(z.number().min(-90).max(90)),
  longitude: databaseNumberSchema.pipe(z.number().min(-180).max(180)),
  outage_type: z.enum(['planned', 'unexpected']),
  consensus_status: z.enum(['ongoing', 'resolved']),
  participant_count: databaseNonnegativeIntegerSchema,
  out_count: databaseNonnegativeIntegerSchema,
  back_count: databaseNonnegativeIntegerSchema,
  out_percentage: databasePercentageSchema,
  back_percentage: databasePercentageSchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  last_activity_at: z.iso.datetime({ offset: true }),
  inactive_at: z.iso.datetime({ offset: true }).nullable(),
});

const incidentPageRowSchema = z.union([
  incidentRowSchema.extend({
    total_count: databaseNonnegativeIntegerSchema,
  }),
  z
    .object({
      id: z.null(),
      total_count: databaseNonnegativeIntegerSchema,
    })
    .passthrough(),
]);

const aggregateStatsRowSchema = z.object({
  incidents_last_10_minutes: databaseNonnegativeIntegerSchema,
  active_incident_count: databaseNonnegativeIntegerSchema,
  affected_state_count: databaseNonnegativeIntegerSchema,
  bengaluru_active_count: databaseNonnegativeIntegerSchema,
  generated_at: z.iso.datetime({ offset: true }),
});

const locationAggregateRowSchema = z.object({
  normalized_state: z.string().min(1).max(100),
  normalized_city: z.string().min(1).max(100),
  normalized_locality: z.string().min(1).max(100),
  normalized_sector: z.string().min(1).max(100).nullable(),
  state_label: z.string().min(1).max(100),
  city_label: z.string().min(1).max(100),
  locality_label: z.string().min(1).max(100),
  sector_label: z.string().min(1).max(100).nullable(),
  incident_count: databaseNonnegativeIntegerSchema,
  active_incident_count: databaseNonnegativeIntegerSchema,
  total_count: databaseNonnegativeIntegerSchema,
});

const locationAggregatePageRowSchema = z.union([
  locationAggregateRowSchema,
  z
    .object({
      normalized_state: z.null(),
      total_count: databaseNonnegativeIntegerSchema,
    })
    .passthrough(),
]);

const nearbyIncidentRowSchema = incidentRowSchema.extend({
  distance_km: databaseNumberSchema.pipe(z.number().nonnegative()),
});

const apiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.enum(PUBLIC_API_ERROR_CODES),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

const mutationEnvelopeSchema = z.object({
  data: z.object({
    incident: z.unknown(),
    wasCreated: z.boolean().optional(),
  }),
});

export class ReportsApiError extends Error {
  readonly status: number;
  readonly code: ReportsErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    status: number,
    code: ReportsErrorCode,
    message: string,
    options: {
      cause?: unknown;
      details?: Readonly<Record<string, unknown>>;
    } = {},
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = 'ReportsApiError';
    this.status = status;
    this.code = code;
    this.details = options.details;
  }
}

function invalidResponse(message: string, cause?: unknown): ReportsApiError {
  return new ReportsApiError(502, 'INVALID_RESPONSE', message, {
    ...(cause === undefined ? {} : { cause }),
  });
}

function roundPercentage(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertConsensusInvariant(
  consensus: Incident['consensus'],
): Incident['consensus'] {
  if (
    consensus.participantCount !==
    consensus.outCount + consensus.backCount
  ) {
    throw invalidResponse('Incident consensus counts are inconsistent');
  }

  const expectedOut =
    consensus.participantCount === 0
      ? 0
      : roundPercentage(
          (100 * consensus.outCount) / consensus.participantCount,
        );
  const expectedBack =
    consensus.participantCount === 0
      ? 0
      : roundPercentage(
          (100 * consensus.backCount) / consensus.participantCount,
        );

  if (
    Math.abs(consensus.outPercentage - expectedOut) > 0.01 ||
    Math.abs(consensus.backPercentage - expectedBack) > 0.01
  ) {
    throw invalidResponse('Incident consensus percentages are inconsistent');
  }

  return {
    ...consensus,
    outPercentage: expectedOut,
    backPercentage: expectedBack,
  };
}

function parseIncident(value: unknown): Incident {
  const parsed = incidentSchema.safeParse(value);
  if (!parsed.success) {
    throw invalidResponse('The incident service returned invalid data', parsed.error);
  }

  const incident = parsed.data;
  const state = incident.location.state ?? incident.location.stateLabel;
  const city = incident.location.city ?? incident.location.cityLabel;
  const locality =
    incident.location.locality ?? incident.location.localityLabel;
  if (!state || !city || !locality) {
    throw invalidResponse('Incident location labels are incomplete');
  }

  return {
    id: incident.id,
    slug: incident.slug,
    location: {
      normalizedState: incident.location.normalizedState,
      normalizedCity: incident.location.normalizedCity,
      normalizedLocality: incident.location.normalizedLocality,
      normalizedSector: incident.location.normalizedSector ?? null,
      state,
      city,
      locality,
      sector:
        incident.location.sector ?? incident.location.sectorLabel ?? null,
      pincode: incident.location.pincode ?? null,
      latitude: incident.location.latitude,
      longitude: incident.location.longitude,
    },
    outageType: incident.outageType,
    status: incident.status,
    consensus: assertConsensusInvariant(incident.consensus),
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
    lastActivityAt: incident.lastActivityAt,
    inactiveAt: incident.inactiveAt ?? null,
  };
}

export function mapIncidentRow(value: unknown): Incident {
  const parsed = incidentRowSchema.safeParse(value);
  if (!parsed.success) {
    throw invalidResponse('The incident query returned invalid data', parsed.error);
  }

  const row = parsed.data;
  return {
    id: row.id,
    slug: row.slug,
    location: {
      normalizedState: row.normalized_state,
      normalizedCity: row.normalized_city,
      normalizedLocality: row.normalized_locality,
      normalizedSector: row.normalized_sector,
      state: row.state_label,
      city: row.city_label,
      locality: row.locality_label,
      sector: row.sector_label,
      pincode: row.pincode,
      latitude: row.latitude,
      longitude: row.longitude,
    },
    outageType: row.outage_type,
    status: row.consensus_status,
    consensus: assertConsensusInvariant({
      participantCount: row.participant_count,
      outCount: row.out_count,
      backCount: row.back_count,
      outPercentage: row.out_percentage,
      backPercentage: row.back_percentage,
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActivityAt: row.last_activity_at,
    inactiveAt: row.inactive_at,
  };
}

function trimFilter(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function optionalInteger(
  value: number | undefined,
  defaultValue: number,
  minimum: number,
  maximum: number,
  message: string,
): number {
  if (value === undefined) {
    return defaultValue;
  }
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new ReportsApiError(400, 'VALIDATION_ERROR', message);
  }
  if (value < minimum || value > maximum) {
    throw new ReportsApiError(400, 'VALIDATION_ERROR', message);
  }
  return value;
}

function optionalNumber(
  value: number | undefined,
  defaultValue: number,
  minimum: number,
  maximum: number,
  message: string,
): number {
  if (value === undefined) {
    return defaultValue;
  }
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ReportsApiError(400, 'VALIDATION_ERROR', message);
  }
  return value;
}

function validatedTimestamp(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  if (!z.iso.datetime({ offset: true }).safeParse(value).success) {
    throw new ReportsApiError(
      400,
      'VALIDATION_ERROR',
      'The aggregate timestamp is invalid',
    );
  }
  return value;
}

function throwReadError(message: string, error: { message: string }): never {
  throw new ReportsApiError(503, 'SERVICE_UNAVAILABLE', message, {
    cause: error,
  });
}

function mapThrownReadError(
  message: string,
  error: unknown,
): ReportsApiError {
  if (error instanceof ReportsApiError) {
    return error;
  }
  if (error instanceof BrowserEnvironmentError) {
    return new ReportsApiError(
      500,
      'CONFIGURATION_ERROR',
      'The public data service is not configured',
      { cause: error },
    );
  }
  return new ReportsApiError(0, 'NETWORK_ERROR', message, { cause: error });
}

async function runSupabaseRead<T>(
  operation: () => PromiseLike<T>,
  networkErrorMessage: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapThrownReadError(networkErrorMessage, error);
  }
}

function compareIncidents(left: Incident, right: Incident): number {
  const activityDifference =
    Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt);
  return activityDifference !== 0
    ? activityDifference
    : left.id.localeCompare(right.id);
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    const result: unknown = await response.json();
    return result;
  } catch (error) {
    throw invalidResponse('The API returned a non-JSON response', error);
  }
}

async function postMutation<TPayload>(
  fetcher: typeof fetch,
  path: '/api/incidents' | '/api/observations',
  payload: TPayload,
): Promise<{ incident: Incident; wasCreated?: boolean }> {
  let response: Response;
  try {
    response = await fetcher(path, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new ReportsApiError(
      0,
      'NETWORK_ERROR',
      'Unable to reach the incident service',
      { cause: error },
    );
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    const parsedError = apiErrorEnvelopeSchema.safeParse(body);
    if (parsedError.success) {
      throw new ReportsApiError(
        response.status,
        parsedError.data.error.code,
        parsedError.data.error.message,
        {
          ...(parsedError.data.error.details === undefined
            ? {}
            : { details: parsedError.data.error.details }),
        },
      );
    }

    throw new ReportsApiError(
      response.status,
      response.status >= 500 ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR',
      'The incident service rejected the request',
    );
  }

  const body = await parseJsonResponse(response);
  const parsedEnvelope = mutationEnvelopeSchema.safeParse(body);
  if (!parsedEnvelope.success) {
    throw invalidResponse(
      'The incident service returned an invalid response',
      parsedEnvelope.error,
    );
  }

  return {
    incident: parseIncident(parsedEnvelope.data.data.incident),
    ...(parsedEnvelope.data.data.wasCreated === undefined
      ? {}
      : { wasCreated: parsedEnvelope.data.data.wasCreated }),
  };
}

export interface IncidentSubscriptionOptions {
  debounceMs?: number;
  onError?: (error: Error) => void;
}

export interface ReportsApi {
  listIncidents: (query?: IncidentListQuery) => Promise<IncidentListResult>;
  getIncidentBySlug: (slug: string) => Promise<Incident | null>;
  getAggregateStats: () => Promise<AggregateStats>;
  getLocationAggregates: (
    query?: LocationAggregateQuery,
  ) => Promise<LocationAggregateResult>;
  getNearbyIncidents: (
    query: NearbyIncidentQuery,
  ) => Promise<NearbyIncident[]>;
  createOrJoinIncident: (
    payload: CreateOrJoinIncidentPayload,
  ) => Promise<CreateOrJoinIncidentResult>;
  submitObservation: (
    payload: SubmitObservationPayload,
  ) => Promise<ObservationResult>;
  subscribeToIncidentChanges: (
    onRefresh: () => void | Promise<void>,
    options?: IncidentSubscriptionOptions,
  ) => () => void;
}

export interface ReportsApiDependencies {
  getClient: () => BrowserSupabaseClient;
  fetch: typeof fetch;
}

const defaultFetch: typeof fetch = (input, init) =>
  globalThis.fetch(input, init);

export function createReportsApi(
  dependencies: Partial<ReportsApiDependencies> = {},
): ReportsApi {
  const getClient = dependencies.getClient ?? getBrowserSupabaseClient;
  const fetcher = dependencies.fetch ?? defaultFetch;

  return {
    async listIncidents(
      query: IncidentListQuery = {},
    ): Promise<IncidentListResult> {
      const limit = optionalInteger(
        query.limit,
        DEFAULT_INCIDENT_LIMIT,
        1,
        MAX_INCIDENT_LIMIT,
        'Incident page size is invalid',
      );
      const offset = optionalInteger(
        query.offset,
        0,
        0,
        MAX_OFFSET,
        'Incident page offset is invalid',
      );
      const { data, error } = await runSupabaseRead(
        () =>
          getClient().rpc('get_public_incidents_filtered', {
            p_state: trimFilter(query.state),
            p_city: trimFilter(query.city),
            p_locality: trimFilter(query.locality),
            p_sector: trimFilter(query.sector),
            p_outage_type: query.outageType ?? null,
            p_consensus_status: query.status ?? null,
            p_active_only: query.activeOnly ?? false,
            p_limit: limit,
            p_offset: offset,
          }),
        'Unable to reach the incident service',
      );
      if (error) {
        throwReadError('Unable to load incidents', error);
      }

      const parsed = z.array(incidentPageRowSchema).safeParse(data);
      if (!parsed.success) {
        throw invalidResponse('The incident query returned invalid data', parsed.error);
      }

      const pageRows = parsed.data.filter(
        (row): row is Extract<typeof row, { id: string }> =>
          'id' in row && typeof row.id === 'string',
      );
      const incidents = pageRows
        .map((row) => mapIncidentRow(row))
        .sort(compareIncidents);
      const total = parsed.data[0]?.total_count ?? 0;
      return {
        incidents,
        total,
        limit,
        offset,
        hasMore: offset + incidents.length < total,
      };
    },

    async getIncidentBySlug(slug: string): Promise<Incident | null> {
      const normalizedSlug = slug.trim();
      if (!SLUG_PATTERN.test(normalizedSlug)) {
        throw new ReportsApiError(
          400,
          'VALIDATION_ERROR',
          'Incident slug is invalid',
        );
      }

      const { data, error } = await runSupabaseRead(
        () =>
          getClient().rpc('get_incident_by_slug', {
            p_slug: normalizedSlug,
          }),
        'Unable to reach the incident service',
      );
      if (error) {
        throwReadError('Unable to load the incident', error);
      }

      const parsed = z.array(incidentRowSchema).max(1).safeParse(data);
      if (!parsed.success) {
        throw invalidResponse('The incident query returned invalid data', parsed.error);
      }
      return parsed.data[0] ? mapIncidentRow(parsed.data[0]) : null;
    },

    async getAggregateStats(): Promise<AggregateStats> {
      const { data, error } = await runSupabaseRead(
        () => getClient().rpc('get_public_incident_stats'),
        'Unable to reach the incident statistics service',
      );
      if (error) {
        throwReadError('Unable to load incident statistics', error);
      }

      const parsed = z.array(aggregateStatsRowSchema).length(1).safeParse(data);
      if (!parsed.success) {
        throw invalidResponse(
          'The incident statistics query returned invalid data',
          parsed.error,
        );
      }

      const row = parsed.data[0];
      if (!row) {
        throw invalidResponse('The incident statistics query returned no data');
      }
      return {
        incidentsLast10Minutes: row.incidents_last_10_minutes,
        activeIncidents: row.active_incident_count,
        affectedStates: row.affected_state_count,
        generatedAt: row.generated_at,
      };
    },

    async getLocationAggregates(
      query: LocationAggregateQuery = {},
    ): Promise<LocationAggregateResult> {
      const limit = optionalInteger(
        query.limit,
        DEFAULT_LOCATION_LIMIT,
        1,
        MAX_LOCATION_LIMIT,
        'Location aggregate page size is invalid',
      );
      const offset = optionalInteger(
        query.offset,
        0,
        0,
        MAX_OFFSET,
        'Location aggregate page offset is invalid',
      );
      const { data, error } = await runSupabaseRead(
        () =>
          getClient().rpc('get_public_location_aggregates', {
            p_state: trimFilter(query.state),
            p_city: trimFilter(query.city),
            p_active_only: query.activeOnly ?? false,
            p_since: validatedTimestamp(query.since),
            p_limit: limit,
            p_offset: offset,
          }),
        'Unable to reach the location aggregate service',
      );
      if (error) {
        throwReadError('Unable to load location aggregates', error);
      }

      const parsed = z.array(locationAggregatePageRowSchema).safeParse(data);
      if (!parsed.success) {
        throw invalidResponse(
          'The location aggregate query returned invalid data',
          parsed.error,
        );
      }

      const aggregates = parsed.data.flatMap((row) => {
        if (row.normalized_state === null) {
          return [];
        }
        return [
          {
            normalizedState: row.normalized_state,
            normalizedCity: row.normalized_city,
            normalizedLocality: row.normalized_locality,
            normalizedSector: row.normalized_sector,
            state: row.state_label,
            city: row.city_label,
            locality: row.locality_label,
            sector: row.sector_label,
            incidentCount: row.incident_count,
            activeIncidentCount: row.active_incident_count,
          },
        ];
      });
      const total = parsed.data[0]?.total_count ?? 0;
      return {
        aggregates,
        total,
        limit,
        offset,
        hasMore: offset + aggregates.length < total,
      };
    },

    async getNearbyIncidents(
      query: NearbyIncidentQuery,
    ): Promise<NearbyIncident[]> {
      if (
        !Number.isFinite(query.latitude) ||
        query.latitude < -90 ||
        query.latitude > 90 ||
        !Number.isFinite(query.longitude) ||
        query.longitude < -180 ||
        query.longitude > 180
      ) {
        throw new ReportsApiError(
          400,
          'VALIDATION_ERROR',
          'Nearby coordinates are invalid',
        );
      }

      const radiusKm = optionalNumber(
        query.radiusKm,
        DEFAULT_NEARBY_RADIUS_KM,
        0.1,
        MAX_NEARBY_RADIUS_KM,
        'The nearby radius is invalid',
      );
      const limit = optionalInteger(
        query.limit,
        DEFAULT_NEARBY_LIMIT,
        1,
        MAX_NEARBY_LIMIT,
        'Nearby incident limit is invalid',
      );
      if (
        query.excludeIncidentId !== undefined &&
        !UUID_PATTERN.test(query.excludeIncidentId)
      ) {
        throw new ReportsApiError(
          400,
          'VALIDATION_ERROR',
          'The excluded incident id is invalid',
        );
      }
      const { data, error } = await runSupabaseRead(
        () =>
          getClient().rpc('get_nearby_public_incidents', {
            p_latitude: query.latitude,
            p_longitude: query.longitude,
            p_radius_km: radiusKm,
            p_limit: limit,
            p_exclude_incident_id: query.excludeIncidentId ?? null,
          }),
        'Unable to reach the nearby incident service',
      );
      if (error) {
        throwReadError('Unable to load nearby incidents', error);
      }

      const parsed = z.array(nearbyIncidentRowSchema).safeParse(data);
      if (!parsed.success) {
        throw invalidResponse(
          'The nearby incident query returned invalid data',
          parsed.error,
        );
      }
      return parsed.data.map((row) => ({
        incident: mapIncidentRow(row),
        distanceKm: Math.round(row.distance_km * 100) / 100,
      }));
    },

    async createOrJoinIncident(
      payload: CreateOrJoinIncidentPayload,
    ): Promise<CreateOrJoinIncidentResult> {
      const result = await postMutation(fetcher, '/api/incidents', payload);
      if (result.wasCreated === undefined) {
        throw invalidResponse('Incident creation omitted a created flag');
      }
      return {
        incident: result.incident,
        wasCreated: result.wasCreated,
      };
    },

    async submitObservation(
      payload: SubmitObservationPayload,
    ): Promise<ObservationResult> {
      const result = await postMutation(fetcher, '/api/observations', payload);
      return { incident: result.incident };
    },

    subscribeToIncidentChanges(
      onRefresh: () => void | Promise<void>,
      options: IncidentSubscriptionOptions = {},
    ): () => void {
      let client: BrowserSupabaseClient;
      try {
        client = getClient();
      } catch (error) {
        throw mapThrownReadError(
          'Unable to configure realtime incident updates',
          error,
        );
      }
      const debounceMs = Math.min(
        Math.max(Math.trunc(options.debounceMs ?? 250), 0),
        5_000,
      );
      let disposed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let inFlight = false;
      let queued = false;

      const reportError = (error: unknown): void => {
        if (disposed || !options.onError) {
          return;
        }
        options.onError(
          error instanceof Error
            ? error
            : new Error('Realtime incident refresh failed'),
        );
      };
      const runRefresh = (): void => {
        if (disposed) {
          return;
        }
        if (inFlight) {
          queued = true;
          return;
        }
        inFlight = true;
        void Promise.resolve()
          .then(onRefresh)
          .catch(reportError)
          .finally(() => {
            inFlight = false;
            if (queued && !disposed) {
              queued = false;
              scheduleRefresh();
            }
          });
      };
      const scheduleRefresh = (): void => {
        if (disposed) {
          return;
        }
        if (timer !== undefined) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          timer = undefined;
          runRefresh();
        }, debounceMs);
      };

      const channel = client
        .channel('public:incidents')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'incidents',
          },
          scheduleRefresh,
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reportError(new Error('Realtime incident updates are unavailable'));
          }
        });

      return () => {
        if (disposed) {
          return;
        }
        disposed = true;
        if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
        void client.removeChannel(channel).then((status) => {
          if (disposed) {
            return;
          }
          if (status === 'error') {
            reportError(new Error('Unable to remove realtime subscription'));
          }
        }, (error: unknown) => {
          reportError(error);
        });
      };
    },
  };
}

export const reportsApi = createReportsApi();

export function toCompatibilityReport(incident: Incident): Report {
  const x = ((incident.location.longitude + 180) / 360) * 100;
  const y = ((90 - incident.location.latitude) / 180) * 100;
  return {
    ...incident,
    locality: incident.location.locality,
    city: incident.location.city,
    state: incident.location.state,
    type: incident.outageType,
    reportedAt: incident.createdAt,
    confirms: incident.consensus.outCount,
    x,
    y,
    ...(incident.inactiveAt ? { resolvedAt: incident.inactiveAt } : {}),
  };
}

export async function listReports(): Promise<Report[]> {
  const result = await reportsApi.listIncidents();
  return result.incidents.map(toCompatibilityReport);
}

export async function getReportBySlug(
  slug: string,
): Promise<Report | undefined> {
  const incident = await reportsApi.getIncidentBySlug(slug);
  return incident ? toCompatibilityReport(incident) : undefined;
}

export async function createReport(input: NewReportInput): Promise<Report> {
  if (
    input.latitude === undefined ||
    input.longitude === undefined ||
    input.turnstileToken === undefined
  ) {
    throw new ReportsApiError(
      400,
      'VALIDATION_ERROR',
      'Complete location verification before reporting an incident',
    );
  }

  const result = await reportsApi.createOrJoinIncident({
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
}

export async function confirmReport(
  id: string,
  turnstileToken?: string,
): Promise<Report | undefined> {
  if (!turnstileToken) {
    throw new ReportsApiError(
      400,
      'VALIDATION_ERROR',
      'Complete verification before submitting an observation',
    );
  }
  const result = await reportsApi.submitObservation({
    incidentId: id,
    state: 'out',
    turnstileToken,
  });
  return toCompatibilityReport(result.incident);
}

export async function resolveReport(
  id: string,
  turnstileToken?: string,
): Promise<Report | undefined> {
  if (!turnstileToken) {
    throw new ReportsApiError(
      400,
      'VALIDATION_ERROR',
      'Complete verification before submitting an observation',
    );
  }
  const result = await reportsApi.submitObservation({
    incidentId: id,
    state: 'back',
    turnstileToken,
  });
  return toCompatibilityReport(result.incident);
}
