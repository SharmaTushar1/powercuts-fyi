import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useReports } from '../context/ReportsContext';
import { ReportCard } from '../components/ReportCard';
import { ResolveModal } from '../components/ResolveModal';
import { usePageMeta } from '../hooks/usePageMeta';
import { isTurnstileConfigured, requestTurnstileToken } from '../lib/turnstile';
import { getSiteOrigin } from '../lib/site';
import { localizedPath } from '../i18n/paths';
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
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'hi' ? 'hi' : 'en';
  const home = localizedPath('/', language);
  const reportPath = localizedPath('/report', language);
  const params = useParams<{ city?: string; locality?: string; state?: string }>();
  const primarySlug = params.city ?? params.state ?? '';
  const localitySlug = params.locality;

  const resolved = useMemo(
    () => resolveSeoPlace(primarySlug, localitySlug),
    [primarySlug, localitySlug],
  );

  const { fetchIncidents, submitObservation } = useReports();
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [loadError, setLoadError] = useState(false);
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
    setActiveCount(0);
    setLoadError(false);
    void Promise.allSettled([
      fetchIncidents({ ...filterQuery, limit: VISIBLE_INCIDENTS_LIMIT }),
      fetchIncidents({ ...filterQuery, activeOnly: true, limit: 1 }),
    ]).then(([list, activeOnly]) => {
      if (cancelled) return;
      if (list.status === 'fulfilled') {
        setIncidents(list.value.incidents);
      }
      if (activeOnly.status === 'fulfilled') {
        setActiveCount(activeOnly.value.total);
      }
      if (list.status === 'rejected' || activeOnly.status === 'rejected') {
        setLoadError(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchIncidents, filterQuery]);

  const heading = powercutHeading(resolved.displayName, language);
  const description = locationDescription(resolved.displayName, activeCount, language);
  const origin = getSiteOrigin();

  // Hindi routes live under /hi, so canonical/og URLs and JSON-LD must point at
  // the locale-prefixed path rather than the bare English one.
  const localizedPlace = useMemo(
    () => ({ ...resolved, path: localizedPath(resolved.path, language) }),
    [resolved, language],
  );

  usePageMeta({
    title: locationDocumentTitle(resolved.displayName, language),
    description,
    path: localizedPlace.path,
    index: resolved.indexable || activeCount > 0,
    jsonLd: locationJsonLd(origin, localizedPlace, activeCount, language),
  });

  const observe = async (incident: Incident, state: 'out' | 'back'): Promise<void> => {
    setActionError(null);
    if (!isTurnstileConfigured()) {
      setActionError(t('common.verificationPaused'));
      return;
    }
    setPendingIds((current) => new Set(current).add(incident.id));
    try {
      const token = await requestTurnstileToken('record-observation');
      const result = await submitObservation({
        incidentId: incident.id,
        state,
        turnstileToken: token,
      });
      const updated = result.incident;
      setIncidents((current) =>
        current?.map((item) => (item.id === updated.id ? updated : item)) ?? current,
      );
      if (incident.status !== updated.status) {
        setActiveCount((count) =>
          updated.status === 'ongoing' ? count + 1 : Math.max(count - 1, 0),
        );
      }
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : t('common.unableToRecordObservation'),
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
      <Link to={home} className="back-link mono">
        {t('location.backToAll')}
      </Link>

      <h1 className="location-heading">{heading}</h1>
      <p className="location-description">{description}</p>

      {actionError && (
        <div className="page-banner" role="alert">
          {actionError}
        </div>
      )}

      <div className="location-list">
        {loadError && (
          <div className="location-error mono" role="alert">
            {t('location.unableToLoad')}
          </div>
        )}
        {!loadError && incidents === null && (
          <div className="location-loading mono">{t('common.loadingReports')}</div>
        )}
        {!loadError && incidents?.length === 0 && (
          <div className="location-empty mono">
            {t('location.noReportsYet', { place: resolved.displayName })}
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

      <Link to={reportPath} className="btn btn-primary location-report-cta">
        {t('location.reportCutIn', { place: resolved.displayName })}
      </Link>

      <div className="location-faq">
        {faqItems(resolved.displayName, language).map((item) => (
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
