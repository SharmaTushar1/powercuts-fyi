import { useEffect, useRef } from 'react';
import {
  GeoJSONSource,
  Map as MapLibreMap,
  NavigationControl,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Incident } from '../types';
import { getBrowserEnv } from '../lib/env';
import { locationTitle } from '../lib/incidentCopy';

interface IncidentMapProps {
  incidents: Incident[];
  selectedId?: string | null;
  onSelect?: (incident: Incident) => void;
  center?: { latitude: number; longitude: number } | null;
}

const INDIA_CENTER: [number, number] = [78.96, 21.59];

function toFeatureCollection(incidents: Incident[]) {
  return {
    type: 'FeatureCollection' as const,
    features: incidents.map((incident) => ({
      type: 'Feature' as const,
      properties: {
        id: incident.id,
        slug: incident.slug,
        title: locationTitle(incident),
        status: incident.status,
        type: incident.outageType,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [incident.location.longitude, incident.location.latitude],
      },
    })),
  };
}

export function IncidentMap({
  incidents,
  selectedId,
  onSelect,
  center,
}: IncidentMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const incidentsRef = useRef(incidents);
  const centerRef = useRef(center);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    incidentsRef.current = incidents;
  }, [incidents]);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let mapTilerKey: string | null = null;
    try {
      mapTilerKey = getBrowserEnv().mapTilerKey;
    } catch {
      mapTilerKey = null;
    }
    if (!mapTilerKey) {
      return;
    }

    const map = new MapLibreMap({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapTilerKey}`,
      center: centerRef.current
        ? [centerRef.current.longitude, centerRef.current.latitude]
        : INDIA_CENTER,
      zoom: centerRef.current ? 11 : 4.4,
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('incidents', {
        type: 'geojson',
        data: toFeatureCollection(incidentsRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 42,
      });
      map.addLayer({
        id: 'incident-clusters',
        type: 'circle',
        source: 'incidents',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#111111',
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
        },
      });
      map.addLayer({
        id: 'incident-cluster-count',
        type: 'symbol',
        source: 'incidents',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 12,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'incident-points',
        type: 'circle',
        source: 'incidents',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-color': [
            'case',
            ['==', ['get', 'status'], 'resolved'],
            '#6aa37a',
            ['==', ['get', 'type'], 'planned'],
            '#888888',
            '#e08a2c',
          ],
        },
      });
    });

    map.on('click', 'incident-points', (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id;
      const incident = incidentsRef.current.find((item) => item.id === id);
      if (incident) {
        onSelectRef.current?.(incident);
      }
    });

    map.on('click', 'incident-clusters', (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const clusterId = feature?.properties?.cluster_id;
      const source = map.getSource('incidents');
      if (
        !(source instanceof GeoJSONSource) ||
        typeof clusterId !== 'number' ||
        !feature?.geometry ||
        feature.geometry.type !== 'Point'
      ) {
        return;
      }
      const coordinates = feature.geometry.coordinates as [number, number];
      void source.getClusterExpansionZoom(clusterId).then((zoom) => {
        map.easeTo({ center: coordinates, zoom });
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) {
      return;
    }
    const source = map.getSource('incidents');
    if (source instanceof GeoJSONSource) {
      source.setData(toFeatureCollection(incidents));
    }
  }, [incidents]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = incidents.find((incident) => incident.id === selectedId);
    if (!map || !selected) {
      return;
    }
    map.easeTo({
      center: [selected.location.longitude, selected.location.latitude],
      zoom: Math.max(map.getZoom(), 12),
    });
  }, [incidents, selectedId]);

  let mapTilerKey: string | null = null;
  try {
    mapTilerKey = getBrowserEnv().mapTilerKey;
  } catch {
    mapTilerKey = null;
  }

  if (!mapTilerKey) {
    return (
      <div className="map-placeholder" role="img" aria-label="Map unavailable">
        <div className="map-caption mono">MAP VIEW — add a MapTiler key to load live tiles</div>
      </div>
    );
  }

  return (
    <div className="incident-map-wrap">
      <div ref={containerRef} className="incident-map" role="application" aria-label="Live outage map" />
      <div className="map-legend mono">
        <span>
          <span className="legend-dot legend-dot-unexpected" />
          Unexpected
        </span>
        <span>
          <span className="legend-dot legend-dot-planned" />
          Planned
        </span>
      </div>
    </div>
  );
}
