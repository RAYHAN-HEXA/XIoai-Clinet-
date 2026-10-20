'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Activity,
  CheckSquare2,
  Database,
  Landmark,
  LayoutDashboard,
  Menu,
  Newspaper,
  PieChart,
  ScrollText,
  Shield,
  TrendingDown,
  X,
  type LucideIcon
} from 'lucide-react';
import { Brand } from '@/components/brand';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/profit', labelKey: 'profit', icon: PieChart },
  { href: '/drivers', labelKey: 'drivers', icon: TrendingDown },
  { href: '/simulator', labelKey: 'simulator', icon: Activity },
  { href: '/financing', labelKey: 'financing', icon: Landmark },
  { href: '/brief', labelKey: 'brief', icon: Newspaper },
  { href: '/approvals', labelKey: 'approvals', icon: CheckSquare2 },
  { href: '/sources', labelKey: 'sources', icon: Database },
  { href: '/audit', labelKey: 'audit', icon: ScrollText },
  { href: '/security', labelKey: 'security', icon: Shield }
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              active ? 'bg-white/10 text-white' : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-white'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* desktop */}
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center px-5">
          <Brand className="text-white" />
        </div>
        <NavLinks />
        <div className="px-5 pb-4 text-[11px] text-sidebar-foreground/40">Shenzhen FinTechathon 2026</div>
      </aside>

      {/* mobile trigger lives in the header; drawer here */}
      <button
        type="button"
        aria-label="Menu"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-4 z-40 rounded-md bg-card p-2 shadow md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between px-5">
              <Brand className="text-white" />
              <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="rounded p-1 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
