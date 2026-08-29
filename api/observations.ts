import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { MutationEnv } from '../server/env';
import { getMutationEnv } from '../server/env';
import { getRequestIp, sendApiError, sendData, sendMethodNotAllowed } from '../server/http';
import {
  mapIncidentDatabaseError,
  parseIncidentMutationResult,
} from '../server/incidents';
import { protectMutation } from '../server/mutation-guard';
import {
  issueParticipantToken,
  readParticipantCookie,
  serializeParticipantCookie,
  verifyParticipantToken,
} from '../server/participant-token';
import { checkRateLimit } from '../server/rate-limit';
import {
  createServerSupabaseClient,
  type ServerSupabaseClient,
} from '../server/supabase';
import { verifyTurnstile } from '../server/turnstile';
import { observationRequestSchema } from '../server/validation';

export interface ObservationsHandlerDependencies {
  getEnv: () => MutationEnv;
  createClient: (environment: MutationEnv) => ServerSupabaseClient;
  verifyTurnstile: typeof verifyTurnstile;
}

const defaultDependencies: ObservationsHandlerDependencies = {
  getEnv: getMutationEnv,
  createClient: createServerSupabaseClient,
  verifyTurnstile,
};

export function createObservationsHandler(
  dependencies: ObservationsHandlerDependencies = defaultDependencies,
) {
  return async function observationsHandler(
    request: VercelRequest,
    response: VercelResponse,
  ): Promise<void> {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    response.setHeader('Cache-Control', 'no-store');

    try {
      const input = observationRequestSchema.parse(request.body);
      const environment = dependencies.getEnv();
      const client = dependencies.createClient(environment);
      const remoteIp = getRequestIp(request);
      const participantToken = readParticipantCookie(request.headers.cookie);
      const { participantHash, participantTokenToSet } = await protectMutation(
        {
          turnstileToken: input.turnstileToken,
          ...(remoteIp ? { remoteIp } : {}),
          participantToken,
          scope: 'observations',
          hmacSecret: environment.PARTICIPANT_HMAC_SECRET,
          participantTokenSecret: environment.PARTICIPANT_TOKEN_SECRET,
          turnstileSecret: environment.TURNSTILE_SECRET_KEY,
          allowedHostnames: environment.TURNSTILE_ALLOWED_HOSTNAMES,
          expectedAction: 'record-observation',
          participantLimit: 30,
          ipPreLimit: 120,
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

      const { data, error } = await client.rpc('record_observation', {
        p_incident_id: input.incidentId,
        p_participant_hash: participantHash,
        p_state: input.state,
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
      sendData(response, 200, result);
    } catch (error) {
      sendApiError(response, error);
    }
  };
}

export default createObservationsHandler();
