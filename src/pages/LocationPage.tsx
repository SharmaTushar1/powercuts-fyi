import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useReports } from '../context/ReportsContext';
import { ReportCard } from '../components/ReportCard';
import { ResolveModal } from '../components/ResolveModal';
import { usePageMeta } from '../hooks/usePageMeta';
import { isTurnstileConfigured, requestTurnstileToken } from '../lib/turnstile';
import { getSiteOrigin } from '../lib/site';
import {
  faqItems,
  locationDescription,
  locationDocumentTitle,
  locationJsonLd,
  powercutHeading,
  resolveSeoPlace,
} from '../lib/seo';
import type { Incident } from '../types';
import './LocationPage.css';

const VISIBLE_INCIDENTS_LIMIT = 30;

export function LocationPage() {
  const params = useParams<{ city?: string; locality?: string; state?: string }>();
  const primarySlug = params.city ?? params.state ?? '';
  const localitySlug = params.locality;

  const resolved = useMemo(
    () => resolveSeoPlace(primarySlug, localitySlug),
    [primarySlug, localitySlug],
  );

  const { fetchIncidents, submitObservation } = useReports();
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [resolving, setResolving] = useState<Incident | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const filterQuery = useMemo(
    () => ({
      state: resolved.state ?? undefined,
      city: resolved.city ?? undefined,
      locality: resolved.locality ?? undefined,
    }),
    [resolved.state, resolved.city, resolved.locality],
  );

  useEffect(() => {
    let cancelled = false;
    setIncidents(null);
    void Promise.all([
      fetchIncidents({ ...filterQuery, limit: VISIBLE_INCIDENTS_LIMIT }),
      fetchIncidents({ ...filterQuery, activeOnly: true, limit: 1 }),
    ])
      .then(([list, activeOnly]) => {
        if (cancelled) return;
        setIncidents(list.incidents);
        setActiveCount(activeOnly.total);
      })
      .catch(() => {
        if (cancelled) return;
        setIncidents([]);
        setActiveCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchIncidents, filterQuery]);

  const heading = powercutHeading(resolved.displayName);
  const description = locationDescription(resolved.displayName, activeCount);
  const origin = getSiteOrigin();

  usePageMeta({
    title: locationDocumentTitle(resolved.displayName),
    description,
    path: resolved.path,
    index: resolved.indexable || activeCount > 0,
    jsonLd: locationJsonLd(origin, resolved, activeCount),
  });

  const observe = async (incident: Incident, state: 'out' | 'back'): Promise<void> => {
    setActionError(null);
    if (!isTurnstileConfigured()) {
      setActionError('Verification is not configured, so observations are paused.');
      return;
    }
    setPendingIds((current) => new Set(current).add(incident.id));
    try {
      const token = await requestTurnstileToken('record-observation');
      await submitObservation({ incidentId: incident.id, state, turnstileToken: token });
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : 'Unable to record that observation.',
      );
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(incident.id);
        return next;
      });
    }
  };

  return (
    <div className="location-page container-pad">
      <Link to="/" className="back-link mono">
        ← back to all reports
      </Link>

      <h1 className="location-heading">{heading}</h1>
      <p className="location-description">{description}</p>

      {actionError && (
        <div className="page-banner" role="alert">
          {actionError}
        </div>
      )}

      <div className="location-list">
        {incidents === null && <div className="location-loading mono">Loading reports…</div>}
        {incidents?.length === 0 && (
          <div className="location-empty mono">
            No reports yet for {resolved.displayName}. Be the first to report a cut here.
          </div>
        )}
        {incidents?.map((incident) => (
          <ReportCard
            key={incident.id}
            incident={incident}
            pending={pendingIds.has(incident.id)}
            onConfirm={(target) => {
              void observe(target, 'out');
            }}
            onRequestResolve={setResolving}
          />
        ))}
      </div>

      <Link to="/report" className="btn btn-primary location-report-cta">
        Report a cut in {resolved.displayName} →
      </Link>

      <div className="location-faq">
        {faqItems(resolved.displayName).map((item) => (
          <div className="location-faq-item" key={item.question}>
            <h2>{item.question}</h2>
            <p>{item.answer}</p>
          </div>
        ))}
      </div>

      {resolving && (
        <ResolveModal
          incident={resolving}
          onCancel={() => setResolving(null)}
          onConfirm={() => {
            const target = resolving;
            setResolving(null);
            void observe(target, 'back');
          }}
        />
      )}
    </div>
  );
}
