import { Link } from 'react-router-dom';
import './InfoPage.css';

export function SupportPage() {
  return (
    <div className="info-page container-pad">
      <div className="section-label">SUPPORT US</div>
      <h1>Chip in for hosting</h1>
      <p>
        powercuts.fyi runs on a small server and a bit of stubbornness. There's no ad revenue and no
        funding round — just hosting bills that scale a little every time a state has a bad week for
        power.
      </p>
      <p>If it's been useful to you, a small one-off contribution helps keep it running and ad-free.</p>
      <div className="support-note mono">
        Donations are not wired up in this version. The site stays free and anonymous either way.
      </div>
      <Link to="/" className="btn btn-secondary">
        ← back home
      </Link>
    </div>
  );
}
