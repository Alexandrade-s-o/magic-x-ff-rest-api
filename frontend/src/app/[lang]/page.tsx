import { notFound } from 'next/navigation';
import { getDictionary, hasLocale } from '@/i18n';
import { I18nProvider } from '@/features/i18n/I18nProvider';
import MagicCatalogApp from '@/features/magic/MagicCatalogApp';

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <I18nProvider lang={lang} dict={getDictionary(lang)}>
      <MagicCatalogApp />
    </I18nProvider>
  );
}
