import { Link } from 'react-router-dom';
import './InfoPage.css';

export function NotFoundPage() {
  return (
    <div className="info-page container-pad">
      <div className="section-label">404</div>
      <h1>Nothing here.</h1>
      <p>This page doesn't exist. Maybe it got resolved.</p>
      <Link to="/" className="btn btn-secondary">
        ← back home
      </Link>
    </div>
  );
}
