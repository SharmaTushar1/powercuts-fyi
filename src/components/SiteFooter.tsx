import { KOFI_URL } from '../lib/site';

export function SiteFooter() {
  return (
    <footer className="site-footer mono">
      <span>
        Crowdsourced power-cut reports for your area.{' '}
        <a href={KOFI_URL} target="_blank" rel="noreferrer">
          Support on Ko-fi
        </a>
      </span>
      <span>powercuts.fyi</span>
    </footer>
  );
}
