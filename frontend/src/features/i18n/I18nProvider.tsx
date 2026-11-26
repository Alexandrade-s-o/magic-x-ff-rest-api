'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Dictionary, Locale } from '@/i18n';

type I18nValue = { lang: Locale; dict: Dictionary };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  lang,
  dict,
  children,
}: I18nValue & { children: ReactNode }) {
  return (
    <I18nContext.Provider value={{ lang, dict }}>
      {children}
    </I18nContext.Provider>
  );
}

/** Idioma activo y textos de la interfaz. */
export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n debe usarse dentro de I18nProvider');
  return value;
}
