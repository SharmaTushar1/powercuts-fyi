import type { Incident, NearbyIncident } from '../types';

export function orderIncidentsByProximity(
  incidents: readonly Incident[],
  nearby: readonly NearbyIncident[],
): Incident[] {
  if (nearby.length === 0) {
    return [...incidents];
  }

  const byId = new Map(incidents.map((incident) => [incident.id, incident]));
  const nearbyIds = new Set<string>();
  const nearbyOrdered: Incident[] = [];

  for (const item of nearby) {
    if (nearbyIds.has(item.incident.id)) {
      continue;
    }
    nearbyIds.add(item.incident.id);
    nearbyOrdered.push(byId.get(item.incident.id) ?? item.incident);
  }

  return [
    ...nearbyOrdered,
    ...incidents.filter((incident) => !nearbyIds.has(incident.id)),
  ];
}
