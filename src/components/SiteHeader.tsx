import { Link, NavLink } from 'react-router-dom';
import './SiteHeader.css';

export function SiteHeader() {
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
            <NavLink to="/#feed" end={false} className="nav-link nav-link-strong">
              REPORTS
            </NavLink>
            <NavLink to="/#map" className="nav-link">
              MAP
            </NavLink>
            <NavLink to="/#browse" className="nav-link">
              BROWSE
            </NavLink>
            <NavLink to="/#how" className="nav-link">
              HOW IT WORKS
            </NavLink>
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
