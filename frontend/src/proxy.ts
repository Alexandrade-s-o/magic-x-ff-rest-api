import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, type Locale } from '@/i18n';

/** Idioma preferido: el guardado en la cookie, si no el del navegador. */
function preferredLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (saved === 'es' || saved === 'en') return saved;

  const header = request.headers.get('accept-language') ?? '';
  for (const part of header.split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase();
    if (tag.startsWith('es')) return 'es';
    if (tag.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request)}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Fuera: archivos de Next, imágenes, archivos con extensión y las rutas que
  // next.config.ts reescribe hacia el backend (si no, recibirían /es delante).
  matcher: [
    '/((?!_next|img|favicon\\.ico|auth|cards|card-types|collections|rarities|users|advisor|.*\\..*).*)',
  ],
};
