export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OutageType = 'planned' | 'unexpected';
export type ConsensusStatus = 'ongoing' | 'resolved';
export type ObservationState = 'out' | 'back';

export type IncidentRow = {
  id: string;
  slug: string;
  normalized_state: string;
  normalized_city: string;
  normalized_locality: string;
  normalized_sector: string | null;
  state_label: string;
  city_label: string;
  locality_label: string;
  sector_label: string | null;
  pincode: string | null;
  latitude: number;
  longitude: number;
  outage_type: OutageType;
  consensus_status: ConsensusStatus;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  last_out_observed_at: string | null;
  inactive_at: string | null;
};

export type IncidentConsensusRow = Omit<IncidentRow, 'last_out_observed_at'> & {
  participant_count: number;
  out_count: number;
  back_count: number;
  out_percentage: number;
  back_percentage: number;
};

export type IncidentConsensusPageRow = IncidentConsensusRow & {
  total_count: number;
};

export type NearbyIncidentRow = IncidentConsensusRow & {
  distance_km: number;
};

export type IncidentStatsRow = {
  incidents_last_10_minutes: number;
  active_incident_count: number;
  affected_state_count: number;
  bengaluru_active_count: number;
  generated_at: string;
};

export type LocationAggregateRow = {
  normalized_state: string;
  normalized_city: string;
  normalized_locality: string;
  normalized_sector: string | null;
  state_label: string;
  city_label: string;
  locality_label: string;
  sector_label: string | null;
  incident_count: number;
  active_incident_count: number;
  total_count: number;
};

export type Database = {
  public: {
    Tables: {
      incidents: {
        Row: IncidentRow;
        Insert: {
          id?: string;
          slug: string;
          normalized_state: string;
          normalized_city: string;
          normalized_locality: string;
          normalized_sector?: string | null;
          state_label: string;
          city_label: string;
          locality_label: string;
          sector_label?: string | null;
          pincode?: string | null;
          latitude: number;
          longitude: number;
          outage_type: OutageType;
          consensus_status?: ConsensusStatus;
          created_at?: string;
          updated_at?: string;
          last_activity_at?: string;
          last_out_observed_at?: string | null;
          inactive_at?: string | null;
        };
        Update: Partial<IncidentRow>;
        Relationships: [];
      };
      observations: {
        Row: {
          id: string;
          incident_id: string;
          participant_hash: string;
          state: ObservationState;
          observed_at: string;
        };
        Insert: {
          id?: string;
          incident_id: string;
          participant_hash: string;
          state: ObservationState;
          observed_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'observations_incident_id_fkey';
            columns: ['incident_id'];
            isOneToOne: false;
            referencedRelation: 'incidents';
            referencedColumns: ['id'];
          },
        ];
      };
      rate_limit_records: {
        Row: {
          scope: string;
          identifier_hash: string;
          window_start: string;
          request_count: number;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          scope: string;
          identifier_hash: string;
          window_start: string;
          request_count: number;
          expires_at: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      incident_consensus: {
        Row: IncidentConsensusRow;
        Relationships: [];
      };
    };
    Functions: {
      consume_rate_limit: {
        Args: {
          p_scope: string;
          p_identifier_hash: string;
          p_max_requests: number;
          p_window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          remaining: number;
          retry_after_seconds: number;
        }[];
      };
      find_or_create_incident: {
        Args: {
          p_normalized_state: string;
          p_normalized_city: string;
          p_normalized_locality: string;
          p_normalized_sector: string | null;
          p_state_label: string;
          p_city_label: string;
          p_locality_label: string;
          p_sector_label: string | null;
          p_pincode: string | null;
          p_latitude: number;
          p_longitude: number;
          p_outage_type: OutageType;
          p_participant_hash: string;
        };
        Returns: Json;
      };
      get_incident_by_slug: {
        Args: { p_slug: string };
        Returns: IncidentConsensusRow[];
      };
      get_public_incidents: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: IncidentConsensusRow[];
      };
      get_public_incidents_filtered: {
        Args: {
          p_state?: string | null;
          p_city?: string | null;
          p_locality?: string | null;
          p_sector?: string | null;
          p_outage_type?: OutageType | null;
          p_consensus_status?: ConsensusStatus | null;
          p_active_only?: boolean;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: IncidentConsensusPageRow[];
      };
      get_public_incident_stats: {
        Args: Record<never, never>;
        Returns: IncidentStatsRow[];
      };
      get_public_location_aggregates: {
        Args: {
          p_state?: string | null;
          p_city?: string | null;
          p_active_only?: boolean;
          p_since?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: LocationAggregateRow[];
      };
      get_nearby_public_incidents: {
        Args: {
          p_latitude: number;
          p_longitude: number;
          p_radius_km?: number;
          p_limit?: number;
          p_exclude_incident_id?: string | null;
        };
        Returns: NearbyIncidentRow[];
      };
      mark_inactive_incidents: {
        Args: { p_as_of?: string };
        Returns: number;
      };
      normalize_location_component: {
        Args: { value: string };
        Returns: string;
      };
      prune_rate_limit_records: {
        Args: { p_as_of?: string };
        Returns: number;
      };
      record_observation: {
        Args: {
          p_incident_id: string;
          p_participant_hash: string;
          p_state: ObservationState;
        };
        Returns: Json;
      };
    };
    Enums: {
      consensus_status: ConsensusStatus;
      observation_state: ObservationState;
      outage_type: OutageType;
    };
    CompositeTypes: Record<never, never>;
  };
};
