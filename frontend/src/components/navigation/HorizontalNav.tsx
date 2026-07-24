import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Settings2, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { navigation } from '../../config/navigation.config';
import { useAuthStore } from '../../lib/store';
import { canAccessRoute } from '../../config/permissions.config';

interface Props {
  onOpenAppearance: () => void;
}

export default function HorizontalNav({ onOpenAppearance }: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, logout, initials, displayName } = useAuthStore();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const role = user?.role ?? '';

  const filteredNavigation = navigation.filter((item) => {
    if (item.href) return canAccessRoute(role, item.href);
    if (item.subItems) return item.subItems.some((sub) => canAccessRoute(role, sub.href));
    return true;
  });

  const isSubItemActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + '/');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-16 bg-white dark:bg-[#16161f] border-b border-gray-200 dark:border-[#262636] flex items-center px-4 lg:px-6 gap-1 relative z-[60] transition-colors">
      <img src="/Image1.png" alt="ARS" className="w-8 h-8 object-contain flex-shrink-0 mr-2" />
      <span className="font-bold text-gray-900 dark:text-white text-[14px] mr-4 hidden lg:block whitespace-nowrap">
        {t('sidebar.appName')}
      </span>

      <div ref={containerRef} className="flex items-center gap-1 overflow-x-auto">
        {filteredNavigation.map((item) => {
          const Icon = item.icon;
          const hasSubItems = !!item.subItems?.length;
          const isActive = item.href ? location.pathname === item.href : false;
          const isParentActive = hasSubItems && item.subItems!.some((sub) => isSubItemActive(sub.href));
          const active = isActive || isParentActive;
          const isOpen = openMenu === item.nameKey;
          const label = t(item.nameKey);

          if (item.href) {
            return (
              <Link
                key={item.nameKey}
                to={item.href}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors"
                style={active
                  ? { backgroundColor: 'color-mix(in srgb, var(--ars-primary) 10%, transparent)', color: 'var(--ars-primary)' }
                  : undefined}
              >
                <span className={active ? '' : 'text-gray-600 dark:text-gray-400'}>
                  <Icon size={15} />
                </span>
                <span className={active ? '' : 'text-gray-700 dark:text-gray-300'}>{label}</span>
              </Link>
            );
          }

          return (
            <div key={item.nameKey} className="relative">
              <button
                onClick={() => setOpenMenu(isOpen ? null : item.nameKey)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-gray-100 dark:hover:bg-[#1e1e2c]"
                style={active
                  ? { backgroundColor: 'color-mix(in srgb, var(--ars-primary) 10%, transparent)', color: 'var(--ars-primary)' }
                  : undefined}
              >
                <span className={active ? '' : 'text-gray-600 dark:text-gray-400'}>
                  <Icon size={15} />
                </span>
                <span className={active ? '' : 'text-gray-700 dark:text-gray-300'}>{label}</span>
                <ChevronDown size={13} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-[#16161f] border border-gray-200 dark:border-[#262636] rounded-lg shadow-lg py-1 z-50">
                  {item.subItems!
                    .filter((sub) => canAccessRoute(role, sub.href))
                    .map((sub) => {
                      const subActive = isSubItemActive(sub.href);
                      const subLabel = t(sub.nameKey);
                      return (
                        <Link
                          key={sub.href}
                          to={sub.href}
                          onClick={() => setOpenMenu(null)}
                          className="flex items-center gap-2 px-4 py-2 text-[12px] transition-colors"
                          style={subActive
                            ? { color: 'var(--ars-primary)', backgroundColor: 'color-mix(in srgb, var(--ars-primary) 8%, transparent)' }
                            : undefined}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-400 dark:bg-gray-600"
                            style={subActive ? { backgroundColor: 'var(--ars-primary)' } : undefined}
                          />
                          <span className={subActive ? '' : 'text-gray-600 dark:text-gray-300'}>{subLabel}</span>
                        </Link>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onOpenAppearance}
          title={t('sidebar.appearanceTooltip')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1e1e2c] text-gray-500 dark:text-gray-400 transition-colors"
        >
          <Settings2 size={17} />
        </button>

        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 select-none"
          style={{ backgroundColor: 'var(--ars-primary)' }}
        >
          {initials()}
        </div>
        <span className="text-[13px] text-gray-700 dark:text-gray-300 hidden md:block whitespace-nowrap">
          {displayName()}
        </span>

        <button
          onClick={logout}
          title={t('sidebar.logoutTooltip')}
          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}