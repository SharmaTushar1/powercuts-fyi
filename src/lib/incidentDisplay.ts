import type { Incident } from '../types';

export function formatConsensusSummary(incident: Incident): string {
  const participants = incident.consensus.participantCount;
  const out = Math.round(incident.consensus.outPercentage);
  const back = Math.round(incident.consensus.backPercentage);
  const people = participants === 1 ? '1 recent report' : `${participants} recent reports`;
  return `${people} · ${out}% power out · ${back}% power back`;
}

export function locationTitle(incident: Incident): string {
  return incident.location.sector
    ? `${incident.location.locality} · ${incident.location.sector}`
    : incident.location.locality;
}

export function locationSubtitle(incident: Incident): string {
  return `${incident.location.city}, ${incident.location.state}`;
}
