import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LocationAggregate } from '../types';
import { localizedPath } from '../i18n/paths';
import './BrowseSection.css';

export function BrowseSection({
  aggregates,
}: {
  aggregates: LocationAggregate[];
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'hi' ? 'hi' : 'en';
  const home = localizedPath('/', language);
  const groups = useMemo(() => {
    const byState = new Map<string, LocationAggregate[]>();
    for (const aggregate of aggregates) {
      const existing = byState.get(aggregate.state) ?? [];
      existing.push(aggregate);
      byState.set(aggregate.state, existing);
    }
    return Array.from(byState.entries())
      .map(([state, items]) => {
        const byCity = new Map<string, LocationAggregate[]>();
        for (const item of items) {
          const cityItems = byCity.get(item.city) ?? [];
          cityItems.push(item);
          byCity.set(item.city, cityItems);
        }
        const cities = Array.from(byCity.entries())
          .map(([city, cityItems]) => ({
            city,
            count: cityItems.reduce((sum, item) => sum + item.activeIncidentCount, 0),
            localities: cityItems
              .map((item) => ({
                locality: item.locality,
                sector: item.sector,
                label: item.sector
                  ? `${item.locality} · ${item.sector}`
                  : item.locality,
                count: item.activeIncidentCount,
              }))
              .sort((left, right) => right.count - left.count),
          }))
          .sort((left, right) => right.count - left.count);
        return {
          state,
          count: items.reduce((sum, item) => sum + item.activeIncidentCount, 0),
          cities,
        };
      })
      .sort((left, right) => right.count - left.count);
  }, [aggregates]);

  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState(groups[0]?.state ?? '');
  const [selectedCity, setSelectedCity] = useState(groups[0]?.cities[0]?.city ?? '');
  const stateGroup = groups.find((group) => group.state === selectedState) ?? groups[0];
  const cityGroup =
    stateGroup?.cities.find((city) => city.city === selectedCity) ?? stateGroup?.cities[0];
  const visibleStates = groups.filter((group) =>
    group.state.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <section className="browse-section container-pad" id="browse">
      <div className="section-label">{t('browse.sectionLabel')}</div>
      <div className="browse-heading">{t('browse.heading')}</div>

      <div className="browse-grid">
        <div className="browse-col">
          <label className="visually-hidden" htmlFor="browse-search">
            {t('browse.searchLabel')}
          </label>
          <input
            id="browse-search"
            className="browse-search mono"
            placeholder={t('browse.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="browse-list">
            {visibleStates.map((group) => (
              <button
                key={group.state}
                type="button"
                className={group.state === stateGroup?.state ? 'browse-item active' : 'browse-item'}
                onClick={() => {
                  setSelectedState(group.state);
                  setSelectedCity(group.cities[0]?.city ?? '');
                }}
              >
                {group.state}
              </button>
            ))}
            {visibleStates.length === 0 && (
              <div className="browse-empty mono">{t('browse.noStatesMatch')}</div>
            )}
          </div>
        </div>

        <div className="browse-col">
          <div className="browse-col-label mono">
            {t('browse.citiesIn', { state: stateGroup?.state.toUpperCase() ?? '—' })}
          </div>
          <div className="browse-list">
            {stateGroup?.cities.map((city) => (
              <button
                key={city.city}
                type="button"
                className={city.city === cityGroup?.city ? 'browse-item active' : 'browse-item'}
                onClick={() => setSelectedCity(city.city)}
              >
                {city.city} — {city.count}
              </button>
            ))}
          </div>
        </div>

        <div className="browse-col">
          <div className="browse-col-label mono">
            {t('browse.localitiesIn', { city: cityGroup?.city.toUpperCase() ?? '—' })}
          </div>
          <div className="browse-locality-list">
            {cityGroup?.localities.map((locality) => {
              const params = new URLSearchParams({
                state: stateGroup?.state ?? '',
                city: cityGroup.city,
                locality: locality.locality,
              });
              if (locality.sector) {
                params.set('sector', locality.sector);
              }
              return (
                <Link
                  className="browse-locality-row"
                  to={{ pathname: home, search: params.toString(), hash: 'feed' }}
                  key={`${locality.locality}:${locality.sector ?? ''}`}
                >
                  <span>{locality.label}</span>
                  <span className="mono browse-locality-count">{locality.count}</span>
                </Link>
              );
            })}
          </div>
          <div className="browse-note mono">{t('browse.note')}</div>
        </div>
      </div>
    </section>
  );
}
