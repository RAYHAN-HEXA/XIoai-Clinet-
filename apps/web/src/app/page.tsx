import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Brand } from '@/components/brand';
import { DemoStartButton } from '@/components/demo-start-button';
import { Button } from '@/components/ui/button';

export default async function LandingPage() {
  const t = await getTranslations('landing');

  return (
    <main className="min-h-screen">
      <section className="bg-sidebar text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-24 text-center md:py-32">
          <Brand className="text-xl text-white" />
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">{t('title')}</h1>
          <p className="max-w-2xl text-base text-white/70 md:text-lg">{t('subtitle')}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <DemoStartButton />
            <Link href="/register">
              <Button size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                {t('ctaRegister')}
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                {t('ctaLogin')}
              </Button>
            </Link>
          </div>
          <p className="text-xs text-white/40">{t('phase')}</p>
        </div>
      </section>
    </main>
  );
}
