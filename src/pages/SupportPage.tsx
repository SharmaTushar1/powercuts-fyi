import { Link } from 'react-router-dom';
import { KOFI_URL } from '../lib/site';
import './InfoPage.css';

export function SupportPage() {
  return (
    <div className="info-page container-pad">
      <div className="section-label">SUPPORT US</div>
      <h1>Chip in for hosting</h1>
      <p>
        powercuts.fyi runs on a small server and a bit of stubbornness. Hosting bills tick up when
        whole states have a bad week for power — a small one-off contribution helps keep the site
        running.
      </p>
      <p>If it has been useful to you, you can leave a tip on Ko-fi. The site stays free and anonymous.</p>
      <a
        className="btn btn-primary"
        href={KOFI_URL}
        target="_blank"
        rel="noreferrer"
        style={{ display: 'inline-block', marginBottom: 28 }}
      >
        Support on Ko-fi →
      </a>
      <Link to="/" className="btn btn-secondary">
        ← back home
      </Link>
    </div>
  );
}
