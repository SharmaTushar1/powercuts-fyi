import type { TFunction } from 'i18next';
import type { Incident } from '../types';

export function locationTitle(incident: Incident): string {
  const { locality, sector, city } = incident.location;
  const area = sector ? `${locality} · ${sector}` : locality;
  return `${area}, ${city}`;
}

export function consensusSummary(incident: Incident, t: TFunction): string {
  const { participantCount, outPercentage, backPercentage } = incident.consensus;
  return t('card.consensusSummary', {
    count: participantCount,
    outPercent: Math.round(outPercentage),
    backPercent: Math.round(backPercentage),
  });
}
