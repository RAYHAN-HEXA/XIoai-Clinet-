'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Activity,
  CheckSquare2,
  Database,
  Landmark,
  LayoutDashboard,
  Newspaper,
  PieChart,
  ScrollText,
  Shield,
  TrendingDown,
  type LucideIcon
} from 'lucide-react';
import { Brand } from '@/components/brand';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  ready: boolean; // false = screen arrives in a later phase
}

const ITEMS: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, ready: true },
  { href: '/profit', labelKey: 'profit', icon: PieChart, ready: false },
  { href: '/drivers', labelKey: 'drivers', icon: TrendingDown, ready: false },
  { href: '/simulator', labelKey: 'simulator', icon: Activity, ready: false },
  { href: '/financing', labelKey: 'financing', icon: Landmark, ready: false },
  { href: '/brief', labelKey: 'brief', icon: Newspaper, ready: false },
  { href: '/approvals', labelKey: 'approvals', icon: CheckSquare2, ready: false },
  { href: '/sources', labelKey: 'sources', icon: Database, ready: false },
  { href: '/audit', labelKey: 'audit', icon: ScrollText, ready: false },
  { href: '/security', labelKey: 'security', icon: Shield, ready: false }
];

export function AppSidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center px-5">
        <Brand className="text-white" />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {ITEMS.map((item) => {
          const active = item.ready && pathname.startsWith(item.href);
          const content = (
            <>
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{t(item.labelKey)}</span>
              {!item.ready && (
                <span className="ml-auto rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                  {t('soon')}
                </span>
              )}
            </>
          );

          return item.ready ? (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-white/10 text-white' : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-white'
              )}
            >
              {content}
            </Link>
          ) : (
            <span
              key={item.href}
              aria-disabled
              title={t('soon')}
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/40"
            >
              {content}
            </span>
          );
        })}
      </nav>

      <div className="px-5 pb-4 text-[11px] text-sidebar-foreground/40">
        Shenzhen FinTechathon 2026
      </div>
    </aside>
  );
}
