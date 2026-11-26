import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LOCALES, getDictionary, hasLocale } from '@/i18n';
import '../globals.css';

// Solo existen /es y /en; cualquier otro idioma responde 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = getDictionary(lang);
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: { languages: { es: '/es', en: '/en' } },
  };
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <html lang={lang} data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
