import en from './en.json';
import es from './es.json';

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';
/** Cookie que guarda el idioma elegido; la lee `proxy.ts`. */
export const LOCALE_COOKIE = 'lang';

/** La forma del diccionario la define el español. */
export type Dictionary = typeof es;

// Anotar el tipo hace que el build falle si a `en.json` le falta una clave.
const dictionaries: Record<Locale, Dictionary> = { es, en };

export function hasLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Sustituye `{nombre}` en un texto del diccionario. */
export function format(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}
