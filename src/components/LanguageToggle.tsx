import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { localizedPath, stripLanguagePrefix } from '../i18n/paths';

export function LanguageToggle() {
  const location = useLocation();
  const { i18n } = useTranslation();
  const bare = stripLanguagePrefix(location.pathname);
  const isHindi = i18n.language === 'hi';

  return (
    <div className="lang-toggle mono">
      <Link to={{ pathname: localizedPath(bare, 'en'), search: location.search }} className={!isHindi ? 'active' : ''}>
        EN
      </Link>
      <Link to={{ pathname: localizedPath(bare, 'hi'), search: location.search }} className={isHindi ? 'active' : ''}>
        हिं
      </Link>
    </div>
  );
}
