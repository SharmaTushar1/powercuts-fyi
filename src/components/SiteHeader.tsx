import type { MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './SiteHeader.css';

const SECTION_NAV = [
  { hash: 'feed', label: 'REPORTS', className: 'nav-link nav-link-strong' },
  { hash: 'map', label: 'MAP', className: 'nav-link' },
  { hash: 'browse', label: 'BROWSE', className: 'nav-link' },
  { hash: 'how', label: 'HOW IT WORKS', className: 'nav-link' },
] as const;

export function SiteHeader() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleSectionNav = (
    event: MouseEvent<HTMLAnchorElement>,
    hash: string,
  ): void => {
    event.preventDefault();
    if (location.pathname === '/') {
      void navigate({ pathname: '/', search: location.search, hash });
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
      });
      return;
    }
    void navigate({ pathname: '/', hash });
  };

  return (
    <>
      <div className="utility-bar mono">
        <Link to="/vision">OUR VISION — why we built this →</Link>
        <Link to="/support">SUPPORT US — chip in for hosting →</Link>
      </div>

      <nav className="site-nav" aria-label="Primary">
        <div className="site-nav-left">
          <Link to="/" className="wordmark">
            powercuts<span className="mono">.fyi</span>
          </Link>
          <div className="site-nav-links mono">
            {SECTION_NAV.map(({ hash, label, className }) => (
              <a
                key={hash}
                href={`/#${hash}`}
                className={className}
                onClick={(event) => handleSectionNav(event, hash)}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
        <div className="site-nav-right">
          <Link to="/report" className="btn btn-primary mono btn-sm report-cta">
            REPORT A CUT →
          </Link>
        </div>
      </nav>
    </>
  );
}
