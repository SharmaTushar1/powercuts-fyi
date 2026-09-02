import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AggregateStats, LocationAggregate, NearbyLocalityStats, Report } from '../types';
import { useElapsed } from '../hooks/useElapsed';
import { StatusBadge } from './StatusBadge';
import { localizedPath } from '../i18n/paths';
import './Hero.css';

interface HeroProps {
  latest: Report | undefined;
  stats: AggregateStats | null;
  mostAffected: LocationAggregate[];
  nearby: NearbyLocalityStats | null;
}

export function Hero({ latest, stats, mostAffected, nearby }: HeroProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'hi' ? 'hi' : 'en';
  const elapsed = useElapsed(latest?.reportedAt ?? new Date(0).toISOString(), latest?.resolvedAt);
  const largestAffectedCount = Math.max(
    ...mostAffected.map((location) => location.incidentCount),
    1,
  );

  return (
    <section className="hero container-pad" id="top">
      <div className="hero-live mono">
        <span className="live-dot" />
        {t('hero.live', {
          count: stats?.incidentsLast10Minutes ?? 0,
          states: stats?.affectedStates ?? 0,
        })}
      </div>

      <div className="hero-headline">
        {nearby ? (
          <>
            <div className="hero-number mono">{nearby.activeIncidentCount}</div>
            <h1>{t('hero.nearbyHeadline', { place: nearby.locality })}</h1>
          </>
        ) : (
          <>
            <div className="hero-number mono">{stats?.incidentsLast10Minutes ?? 0}</div>
            <h1>{t('hero.nationalHeadline')}</h1>
          </>
        )}
      </div>

      <p className="hero-sub">{t('hero.sub')}</p>

      <div className="hero-ctas">
        <Link to={localizedPath('/report', language)} className="btn btn-primary">
          {t('hero.reportCta')}
        </Link>
        <a href="#feed" className="btn btn-secondary">
          {t('hero.browseCta')}
        </a>
      </div>

      <div className="hero-panel">
        <div className="hero-panel-col">
          <div className="section-label">{t('hero.latestReport')}</div>
          {latest ? (
            <>
              <StatusBadge type={latest.type} status={latest.status} />
              <div className="hero-panel-title">
                {latest.locality}, {latest.city}
              </div>
              <div className="hero-panel-meta mono">
                {latest.status === 'resolved'
                  ? t('hero.resolvedAfter', { elapsed })
                  : t('hero.reportedAgo', { elapsed })}
              </div>
            </>
          ) : (
            <div className="hero-panel-meta mono">{t('hero.noReportsYet')}</div>
          )}
        </div>
        <div className="hero-panel-col">
          <div className="section-label">{t('hero.cutsRightNow')}</div>
          <div className="hero-panel-big mono">{stats?.activeIncidents ?? 0}</div>
          <div className="hero-panel-meta mono">
            {t('hero.acrossIndia')}
            {nearby
              ? t('hero.nearbyRightNow', {
                  count: nearby.activeIncidentCount,
                  place: nearby.locality,
                })
              : ''}
          </div>
        </div>
        <div className="hero-panel-col hero-panel-col-wide">
          <div className="section-label">{t('hero.mostAffectedToday')}</div>
          <div className="affected-list">
            {mostAffected.map((location) => (
              <div
                className="affected-row"
                key={`${location.normalizedState}:${location.normalizedCity}:${location.normalizedLocality}:${location.normalizedSector ?? ''}`}
              >
                <span className="affected-label">
                  {location.locality}, {location.city}
                </span>
                <span className="affected-bar-track">
                  <span
                    className="affected-bar-fill"
                    style={{
                      width: `${Math.round((100 * location.incidentCount) / largestAffectedCount)}%`,
                    }}
                  />
                </span>
                <span className="affected-count mono">{location.incidentCount}</span>
              </div>
            ))}
            {mostAffected.length === 0 && (
              <div className="hero-panel-meta mono">{t('hero.noAffectedAreas')}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
