import type { MouseEvent } from 'react';
import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KOFI_URL } from '../lib/site';
import { localizedPath } from '../i18n/paths';
import { LanguageToggle } from './LanguageToggle';
import './SiteHeader.css';

const SECTION_NAV = [
  { hash: 'feed', labelKey: 'nav.reports', className: 'nav-link nav-link-strong' },
  { hash: 'map', labelKey: 'nav.map', className: 'nav-link' },
  { hash: 'browse', labelKey: 'nav.browse', className: 'nav-link' },
  { hash: 'how', labelKey: 'nav.howItWorks', className: 'nav-link' },
] as const;

/**
 * The home page renders a loading placeholder until reports arrive, so a
 * cross-page jump to #feed has no target on the first frame. Retry for a
 * bounded window instead of giving up after one frame.
 */
const SCROLL_ATTEMPT_LIMIT = 90;

function scrollToSection(id: string): () => void {
  let frame = 0;
  let attempts = 0;
  const attempt = (): void => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    attempts += 1;
    if (attempts < SCROLL_ATTEMPT_LIMIT) {
      frame = requestAnimationFrame(attempt);
    }
  };
  frame = requestAnimationFrame(attempt);
  return () => cancelAnimationFrame(frame);
}

export function SiteHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'hi' ? 'hi' : 'en';
  const home = localizedPath('/', language);

  const hashTarget = location.hash.replace(/^#/u, '');
  useEffect(() => {
    if (!hashTarget) {
      return;
    }
    return scrollToSection(hashTarget);
  }, [hashTarget, location.pathname]);

  const handleSectionNav = (
    event: MouseEvent<HTMLAnchorElement>,
    hash: string,
  ): void => {
    event.preventDefault();
    if (location.pathname === home || (home === '/hi' && location.pathname === '/hi/')) {
      void navigate({ pathname: home, search: location.search, hash });
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
      });
      return;
    }
    void navigate({ pathname: home, hash });
  };

  return (
    <>
      <div className="utility-bar mono">
        <Link to={localizedPath('/vision', language)}>{t('utility.vision')}</Link>
        <a href={KOFI_URL} target="_blank" rel="noreferrer">
          {t('utility.support')}
        </a>
      </div>

      <nav className="site-nav" aria-label="Primary">
        <div className="site-nav-left">
          <Link to={home} className="wordmark">
            powercuts<span className="mono">.fyi</span>
          </Link>
          <div className="site-nav-links mono">
            {SECTION_NAV.map(({ hash, labelKey, className }) => (
              <a
                key={hash}
                href={`${home}#${hash}`}
                className={className}
                onClick={(event) => handleSectionNav(event, hash)}
              >
                {t(labelKey)}
              </a>
            ))}
          </div>
        </div>
        <div className="site-nav-right">
          <LanguageToggle />
          <Link
            to={localizedPath('/report', language)}
            className="btn btn-primary mono btn-sm report-cta"
          >
            {t('nav.reportCut')}
          </Link>
        </div>
      </nav>
    </>
  );
}
