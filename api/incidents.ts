import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { MutationEnv } from './_lib/env';
import { getMutationEnv } from './_lib/env';
import { getRequestIp, sendApiError, sendData, sendMethodNotAllowed } from './_lib/http';
import {
  mapIncidentDatabaseError,
  parseIncidentMutationResult,
} from './_lib/incidents';
import { protectMutation } from './_lib/mutation-guard';
import {
  issueParticipantToken,
  readParticipantCookie,
  serializeParticipantCookie,
  verifyParticipantToken,
} from './_lib/participant-token';
import { checkRateLimit } from './_lib/rate-limit';
import {
  createServerSupabaseClient,
  type ServerSupabaseClient,
} from './_lib/supabase';
import { verifyTurnstile } from './_lib/turnstile';
import { incidentRequestSchema } from './_lib/validation';

export interface IncidentsHandlerDependencies {
  getEnv: () => MutationEnv;
  createClient: (environment: MutationEnv) => ServerSupabaseClient;
  verifyTurnstile: typeof verifyTurnstile;
}

const defaultDependencies: IncidentsHandlerDependencies = {
  getEnv: getMutationEnv,
  createClient: createServerSupabaseClient,
  verifyTurnstile,
};

export function createIncidentsHandler(
  dependencies: IncidentsHandlerDependencies = defaultDependencies,
) {
  return async function incidentsHandler(
    request: VercelRequest,
    response: VercelResponse,
  ): Promise<void> {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    response.setHeader('Cache-Control', 'no-store');

    try {
      const input = incidentRequestSchema.parse(request.body);
      const environment = dependencies.getEnv();
      const client = dependencies.createClient(environment);
      const remoteIp = getRequestIp(request);
      const participantToken = readParticipantCookie(request.headers.cookie);
      const { participantHash, participantTokenToSet } = await protectMutation(
        {
          turnstileToken: input.turnstileToken,
          ...(remoteIp ? { remoteIp } : {}),
          participantToken,
          scope: 'incidents',
          hmacSecret: environment.PARTICIPANT_HMAC_SECRET,
          participantTokenSecret: environment.PARTICIPANT_TOKEN_SECRET,
          turnstileSecret: environment.TURNSTILE_SECRET_KEY,
          allowedHostnames: environment.TURNSTILE_ALLOWED_HOSTNAMES,
          expectedAction: 'report-incident',
          participantLimit: 3,
          ipPreLimit: 20,
          tokenIssuanceLimit: 3,
          windowSeconds: 3600,
          tokenIssuanceWindowSeconds: 86400,
        },
        {
          checkRateLimit: (rule) =>
            checkRateLimit(
              (arguments_) => client.rpc('consume_rate_limit', arguments_),
              rule,
            ),
          verifyTurnstile: (verificationInput) =>
            dependencies.verifyTurnstile(verificationInput),
          issueParticipantToken,
          verifyParticipantToken,
        },
      );

      const { data, error } = await client.rpc('find_or_create_incident', {
        p_normalized_state: input.normalizedState,
        p_normalized_city: input.normalizedCity,
        p_normalized_locality: input.normalizedLocality,
        p_normalized_sector: input.normalizedSector,
        p_state_label: input.stateLabel,
        p_city_label: input.cityLabel,
        p_locality_label: input.localityLabel,
        p_sector_label: input.sectorLabel,
        p_pincode: input.pincode,
        p_latitude: input.latitude,
        p_longitude: input.longitude,
        p_outage_type: input.outageType,
        p_participant_hash: participantHash,
      });

      if (error) {
        throw mapIncidentDatabaseError(error);
      }

      const result = parseIncidentMutationResult(data);
      if (participantTokenToSet) {
        response.setHeader(
          'Set-Cookie',
          serializeParticipantCookie(participantTokenToSet),
        );
      }
      sendData(response, result.wasCreated ? 201 : 200, result);
    } catch (error) {
      sendApiError(response, error);
    }
  };
}

export default createIncidentsHandler();
