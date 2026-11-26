'use client';

import Link from 'next/link';
import { LOCALE_COOKIE, LOCALES } from '@/i18n';
import { useI18n } from './I18nProvider';

/** Botones ES / EN: navegan a la otra ruta y recuerdan la elección. */
export function LanguageSwitcher() {
  const { lang, dict } = useI18n();

  return (
    <nav className="lang-switch" aria-label={dict.language.label}>
      {LOCALES.map((locale) => (
        <Link
          key={locale}
          href={`/${locale}`}
          hrefLang={locale}
          lang={locale}
          className={`lang-option${locale === lang ? ' active' : ''}`}
          aria-current={locale === lang ? 'page' : undefined}
          title={dict.language[locale]}
          onClick={() => {
            document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
          }}
        >
          <span aria-hidden="true">{locale.toUpperCase()}</span>
          <span className="sr-only">{dict.language[locale]}</span>
        </Link>
      ))}
    </nav>
  );
}
