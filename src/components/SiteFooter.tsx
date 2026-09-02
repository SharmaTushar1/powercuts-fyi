import { useTranslation } from 'react-i18next';
import { KOFI_URL } from '../lib/site';

export function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="site-footer mono">
      <span>
        {t('footer.tagline')}{' '}
        <a href={KOFI_URL} target="_blank" rel="noreferrer">
          {t('footer.support')}
        </a>
      </span>
      <span>powercuts.fyi</span>
    </footer>
  );
}
