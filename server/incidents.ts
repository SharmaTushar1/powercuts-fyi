import { z } from 'zod';
import { ApiError } from './http';

const incidentMutationResultSchema = z
  .object({
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
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    outage_type: z.enum(['planned', 'unexpected']),
    consensus_status: z.enum(['ongoing', 'resolved']),
    participant_count: z.number().int().nonnegative(),
    out_count: z.number().int().nonnegative(),
    back_count: z.number().int().nonnegative(),
    out_percentage: z.number().min(0).max(100),
    back_percentage: z.number().min(0).max(100),
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
    last_activity_at: z.iso.datetime({ offset: true }),
    inactive_at: z.iso.datetime({ offset: true }).nullable(),
    was_created: z.boolean().optional(),
  })
  .passthrough();

const databaseErrorSchema = z
  .object({
    code: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export interface IncidentMutationResponse {
  incident: {
    id: string;
    slug: string;
    location: {
      normalizedState: string;
      normalizedCity: string;
      normalizedLocality: string;
      normalizedSector: string | null;
      stateLabel: string;
      cityLabel: string;
      localityLabel: string;
      sectorLabel: string | null;
      pincode: string | null;
      latitude: number;
      longitude: number;
    };
    outageType: 'planned' | 'unexpected';
    status: 'ongoing' | 'resolved';
    consensus: {
      participantCount: number;
      outCount: number;
      backCount: number;
      outPercentage: number;
      backPercentage: number;
    };
    createdAt: string;
    updatedAt: string;
    lastActivityAt: string;
    inactiveAt: string | null;
  };
  wasCreated?: boolean;
}

export function parseIncidentMutationResult(value: unknown): IncidentMutationResponse {
  const parsed = incidentMutationResultSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(
      503,
      'SERVICE_UNAVAILABLE',
      'The incident service returned an invalid response',
      { cause: parsed.error },
    );
  }

  const result = parsed.data;
  return {
    incident: {
      id: result.id,
      slug: result.slug,
      location: {
        normalizedState: result.normalized_state,
        normalizedCity: result.normalized_city,
        normalizedLocality: result.normalized_locality,
        normalizedSector: result.normalized_sector,
        stateLabel: result.state_label,
        cityLabel: result.city_label,
        localityLabel: result.locality_label,
        sectorLabel: result.sector_label,
        pincode: result.pincode,
        latitude: result.latitude,
        longitude: result.longitude,
      },
      outageType: result.outage_type,
      status: result.consensus_status,
      consensus: {
        participantCount: result.participant_count,
        outCount: result.out_count,
        backCount: result.back_count,
        outPercentage: result.out_percentage,
        backPercentage: result.back_percentage,
      },
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      lastActivityAt: result.last_activity_at,
      inactiveAt: result.inactive_at,
    },
    ...(result.was_created === undefined
      ? {}
      : { wasCreated: result.was_created }),
  };
}

export function mapIncidentDatabaseError(error: unknown): ApiError {
  const parsed = databaseErrorSchema.safeParse(error);
  const code = parsed.success ? parsed.data.code : undefined;
  const message = parsed.success ? parsed.data.message : undefined;

  if (code === 'P0002' || message === 'INCIDENT_NOT_FOUND') {
    return new ApiError(404, 'NOT_FOUND', 'Incident not found', { cause: error });
  }

  if (message === 'INCIDENT_INACTIVE') {
    return new ApiError(
      409,
      'CONFLICT',
      'This incident is no longer active',
      { cause: error },
    );
  }

  return new ApiError(
    503,
    'SERVICE_UNAVAILABLE',
    'The incident service is temporarily unavailable',
    { cause: error },
  );
}
