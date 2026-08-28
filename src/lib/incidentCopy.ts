import type { Incident } from '../types';

export function locationTitle(incident: Incident): string {
  const { locality, sector, city } = incident.location;
  const area = sector ? `${locality} · ${sector}` : locality;
  return `${area}, ${city}`;
}

export function consensusSummary(incident: Incident): string {
  const { participantCount, outPercentage, backPercentage } = incident.consensus;
  const people =
    participantCount === 1 ? '1 recent report' : `${participantCount} recent reports`;
  return `${people} · ${Math.round(outPercentage)}% power out · ${Math.round(backPercentage)}% power back`;
}
