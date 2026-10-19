import { getTranslations } from 'next-intl/server';
import { ApiStatus } from '@/components/api-status';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const kpis = [t('kpiRevenue'), t('kpiRealProfit'), t('kpiCashToday'), t('kpiShortage')];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <ApiStatus />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((label) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-muted-foreground/50">—</div>
              <CardDescription className="mt-1 text-xs">{t('phaseNote')}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
