'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useLocale } from 'next-intl';
import { formatFen } from '@/lib/format';

/**
 * Financial charts — every series is real API data (fen in, ¥ out).
 * Colors: emerald = positive, navy = neutral, amber = warning, red = shortage only.
 */

const AXIS = 'hsl(215 16% 47%)';
const GRID = 'hsl(214 32% 88%)';

function moneyTick(fen: number): string {
  const yuan = fen / 100;
  if (Math.abs(yuan) >= 10_000) return `¥${Math.round(yuan / 1000)}k`;
  return `¥${Math.round(yuan)}`;
}

function TooltipMoney({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number | number[]; name?: string; dataKey?: string | number }>; label?: string | number }) {
  const locale = useLocale();
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow">
      <p className="mb-1 font-medium">{String(label ?? '')}</p>
      {payload.map((p, i) => (
        <p key={i} className="tabular-nums text-muted-foreground">
          {String(p.dataKey ?? p.name ?? '')}: {Array.isArray(p.value) ? p.value.map((v) => formatFen(Number(v), locale)).join(' → ') : formatFen(Number(p.value ?? 0), locale)}
        </p>
      ))}
    </div>
  );
}

/** Waterfall: revenue → cost deductions → profit, in ¥. */
export function WaterfallChart({
  steps
}: {
  steps: Array<{ label: string; /** signed fen delta; first step is the opening total */ delta: number; kind: 'total' | 'cost' | 'profit' }>;
}) {
  const locale = useLocale();
  let running = 0;
  const data = steps.map((s) => {
    const start = s.kind === 'total' ? 0 : running;
    const end = s.kind === 'total' ? s.delta : running + s.delta;
    running = end;
    return {
      label: s.label,
      range: [Math.min(start, end), Math.max(start, end)] as [number, number],
      kind: s.kind,
      delta: s.delta
    };
  });

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} interval={0} angle={-18} textAnchor="end" height={54} />
          <YAxis tickFormatter={moneyTick} tick={{ fontSize: 11, fill: AXIS }} width={56} />
          <Tooltip content={<TooltipMoney />} cursor={{ fill: 'hsl(214 32% 96% / 0.6)' }} />
          <Bar dataKey="range" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.kind === 'total' ? 'hsl(217 62% 30%)' : d.kind === 'profit' ? 'hsl(160 84% 39%)' : 'hsl(38 92% 50%)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="sr-only">{steps.map((s) => `${s.label}: ${formatFen(s.delta, locale)}`).join('; ')}</p>
    </div>
  );
}

/** Base vs stressed 30-day cash curve with the shortage day marked. */
export function ForecastChart({
  days,
  stressed,
  shortageDay
}: {
  days: Array<{ day: number; balanceFen: number }>;
  stressed?: Array<{ day: number; balanceFen: number }>;
  shortageDay?: number | null;
}) {
  const locale = useLocale();
  const data = days.map((d, i) => ({
    day: d.day,
    base: d.balanceFen,
    stressed: stressed?.[i]?.balanceFen
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: AXIS }} />
          <YAxis tickFormatter={moneyTick} tick={{ fontSize: 11, fill: AXIS }} width={56} />
          <Tooltip content={<TooltipMoney />} />
          {shortageDay ? (
            <ReferenceLine
              x={shortageDay}
              stroke="hsl(0 72% 51%)"
              label={{ value: `D${shortageDay}`, position: 'insideTopRight', fill: 'hsl(0 72% 51%)', fontSize: 11 }}
            />
          ) : null}
          <ReferenceLine y={0} stroke="hsl(0 72% 51% / 0.5)" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="base" name="base" stroke="hsl(217 62% 30%)" strokeWidth={2} dot={false} />
          {stressed ? <Line type="monotone" dataKey="stressed" name="stressed" stroke="hsl(38 92% 50%)" strokeWidth={2} strokeDasharray="6 4" dot={false} /> : null}
        </LineChart>
      </ResponsiveContainer>
      <p className="sr-only">{`Base minimum: ${formatFen(Math.min(...days.map((d) => d.balanceFen)), locale)}`}</p>
    </div>
  );
}

/** Ranked profit-driver contributions (signed ¥). */
export function DriverBarChart({ data }: { data: Array<{ id: string; label: string; contributionFen: number }> }) {
  const locale = useLocale();
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis type="number" tickFormatter={moneyTick} tick={{ fontSize: 11, fill: AXIS }} />
          <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11, fill: AXIS }} />
          <Tooltip content={<TooltipMoney />} cursor={{ fill: 'hsl(214 32% 96% / 0.6)' }} />
          <Bar dataKey="contributionFen" radius={[0, 3, 3, 0]}>
            {data.map((d) => (
              <Cell key={d.id} fill={d.contributionFen >= 0 ? 'hsl(160 84% 39%)' : 'hsl(38 92% 50%)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="sr-only">{data.map((d) => `${d.label}: ${formatFen(d.contributionFen, locale)}`).join('; ')}</p>
    </div>
  );
}

/** Simple comparison bars (GMV vs settled vs obligations, group rows …). */
export function ComparisonBars({ data }: { data: Array<{ label: string; valueFen: number }> }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} interval={0} />
          <YAxis tickFormatter={moneyTick} tick={{ fontSize: 11, fill: AXIS }} width={56} />
          <Tooltip content={<TooltipMoney />} cursor={{ fill: 'hsl(214 32% 96% / 0.6)' }} />
          <Bar dataKey="valueFen" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={['hsl(217 62% 30%)', 'hsl(160 84% 39%)', 'hsl(38 92% 50%)'][i % 3] ?? 'hsl(217 62% 30%)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
