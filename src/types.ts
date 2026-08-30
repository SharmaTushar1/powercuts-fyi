export type OutageType = 'planned' | 'unexpected';
export type ConsensusStatus = 'ongoing' | 'resolved';
export type ObservationState = 'out' | 'back';

export interface LocalityHierarchy {
  normalizedState: string;
  normalizedCity: string;
  normalizedLocality: string;
  normalizedSector: string | null;
  state: string;
  city: string;
  locality: string;
  sector: string | null;
}

export interface GeographicCoordinates {
  latitude: number;
  longitude: number;
}

export interface IncidentLocation
  extends LocalityHierarchy,
    GeographicCoordinates {
  pincode: string | null;
}

export interface ConsensusCounts {
  participantCount: number;
  outCount: number;
  backCount: number;
}

export interface ConsensusPercentages {
  outPercentage: number;
  backPercentage: number;
}

export type IncidentConsensus = ConsensusCounts & ConsensusPercentages;

export interface Incident {
  id: string;
  slug: string;
  location: IncidentLocation;
  outageType: OutageType;
  status: ConsensusStatus;
  consensus: IncidentConsensus;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  inactiveAt: string | null;
}

export interface IncidentFilterQuery {
  state?: string;
  city?: string;
  locality?: string;
  sector?: string;
  outageType?: OutageType;
  status?: ConsensusStatus;
  activeOnly?: boolean;
}

export type IncidentFilters = IncidentFilterQuery;

export interface IncidentListQuery extends IncidentFilterQuery {
  limit?: number;
  offset?: number;
}

export interface IncidentListResult {
  incidents: Incident[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface AggregateStats {
  incidentsLast10Minutes: number;
  activeIncidents: number;
  affectedStates: number;
  generatedAt: string;
}

export interface NearbyLocalityStats {
  locality: string;
  city: string;
  activeIncidentCount: number;
}

export interface LocationAggregateQuery {
  state?: string;
  city?: string;
  activeOnly?: boolean;
  since?: string;
  limit?: number;
  offset?: number;
}

export interface LocationAggregate extends LocalityHierarchy {
  incidentCount: number;
  activeIncidentCount: number;
}

export interface LocationAggregateResult {
  aggregates: LocationAggregate[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface NearbyIncidentQuery {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
  excludeIncidentId?: string;
}

export interface NearbyIncident {
  incident: Incident;
  distanceKm: number;
}

export interface CreateOrJoinIncidentInput {
  turnstileToken: string;
  state: string;
  city: string;
  locality: string;
  sector?: string;
  pincode?: string;
  latitude: number;
  longitude: number;
  outageType: OutageType;
}

export type CreateOrJoinIncidentPayload = CreateOrJoinIncidentInput;

export interface ObservationInput {
  turnstileToken: string;
  incidentId: string;
  state: ObservationState;
}

export type SubmitObservationPayload = ObservationInput;

export interface ObservationResult {
  incident: Incident;
}

export interface CreateOrJoinIncidentResult {
  incident: Incident;
  wasCreated: boolean;
}

export type PublicApiErrorCode =
  | 'CAPTCHA_FAILED'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'METHOD_NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR';

export type ReportsErrorCode =
  | PublicApiErrorCode
  | 'CONFIGURATION_ERROR'
  | 'INVALID_RESPONSE'
  | 'NETWORK_ERROR';

/**
 * Compatibility shape for the current prototype components. Task 3 will move
 * those components to Incident directly.
 */
export type Report = Incident & {
  locality: string;
  city: string;
  state: string;
  type: OutageType;
  reportedAt: string;
  resolvedAt?: string;
  confirms: number;
  x: number;
  y: number;
};

/**
 * Transitional input accepted by the current report form. Production writes
 * require the optional fields below; Task 3 will collect them in the UI.
 */
export interface NewReportInput {
  locality: string;
  city: string;
  state: string;
  sector?: string;
  pincode?: string;
  type: OutageType;
  latitude?: number;
  longitude?: number;
  turnstileToken?: string;
}

export type CutType = OutageType;
export type IncidentStatus = ConsensusStatus;
export type CutStatus = ConsensusStatus;
