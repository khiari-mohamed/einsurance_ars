import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, X, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../lib/store';
import { canAccessRoute } from '../../config/permissions.config';
import { navigation } from '../../config/navigation.config';

interface SidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAppearance: () => void;
}

export default function SidebarNav({ isOpen, onClose, onOpenAppearance }: SidebarNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, logout, initials, displayName } = useAuthStore();

  const [expandedItems, setExpandedItems] = useState<string[]>(() =>
    navigation
      .filter(
        (item) =>
          item.subItems?.some((sub) =>
            location.pathname === sub.href ||
            location.pathname.startsWith(sub.href + '/'),
          ),
      )
      .map((item) => item.nameKey),
  );

  useEffect(() => {
    setExpandedItems((prev) => {
      const toAdd = navigation
        .filter(
          (item) =>
            item.subItems?.some(
              (sub) =>
                location.pathname === sub.href ||
                location.pathname.startsWith(sub.href + '/'),
            ) && !prev.includes(item.nameKey),
        )
        .map((item) => item.nameKey);
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
    });
  }, [location.pathname]);

  const toggleExpand = (itemKey: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemKey)
        ? prev.filter((n) => n !== itemKey)
        : [...prev, itemKey],
    );
  };

  const role = user?.role ?? '';

  const filteredNavigation = navigation.filter((item) => {
    if (item.href) {
      return canAccessRoute(role, item.href);
    }
    if (item.subItems) {
      return item.subItems.some((sub) => canAccessRoute(role, sub.href));
    }
    return true;
  });

  const isSubItemActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + '/');

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-50 pt-16
          bg-[#f1f1f1] dark:bg-[#0a0a0f] shadow-[0_0_40px_rgba(0,0,0,0.08)]
          flex flex-col
          transition-all duration-300 ease-in-out
          will-change-[width,transform]
          ${isOpen
            ? 'w-64 translate-x-0'
            : 'w-0 lg:w-16 -translate-x-full lg:translate-x-0'
          }
        `}
      >
        {/* ── Logo / header ─────────────────────────────────────────────── */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-gray-200 dark:border-[#262636] flex-shrink-0 overflow-hidden">
          <div
            className={`flex items-center gap-3 transition-opacity duration-200 ${
              isOpen ? 'opacity-100' : 'opacity-0 lg:opacity-0 pointer-events-none'
            }`}
          >
            <img
              src="/Image1.png"
              alt="ARS"
              className="w-8 h-8 object-contain flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight whitespace-nowrap">
                {t('sidebar.appName')}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {t('sidebar.appSubtitle')}
              </p>
            </div>
          </div>

          {/* Collapsed: show only icon */}
          <img
            src="/Image1.png"
            alt="ARS"
            className={`w-7 h-7 object-contain flex-shrink-0 ${
              isOpen ? 'hidden' : 'hidden lg:block'
            }`}
          />

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#1e1e2c] text-gray-500 dark:text-gray-400 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <nav
          className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden
            scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-[#262636] scrollbar-track-transparent"
        >
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isExpanded = expandedItems.includes(item.nameKey);
            const hasSubItems = !!item.subItems?.length;
            const isActive =
              item.href
                ? location.pathname === item.href
                : false;
            const isParentActive =
              hasSubItems &&
              item.subItems!.some((sub) => isSubItemActive(sub.href));
            const label = t(item.nameKey);

            return (
              <div key={item.nameKey}>
                {item.href ? (
                  /* ── Direct link ────────────────────────────────────── */
                  <Link
                    to={item.href}
                    onClick={() => window.innerWidth < 1024 && onClose()}
                    title={!isOpen ? label : undefined}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg
                      transition-all duration-150 group
                      ${isActive
                        ? 'font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1e1e2c] hover:text-gray-900 dark:hover:text-white'
                      }
                    `}
                    style={
                      isActive
                        ? { backgroundColor: 'color-mix(in srgb, var(--ars-primary) 10%, transparent)', color: 'var(--ars-primary)' }
                        : undefined
                    }
                  >
                    <Icon
                      size={17}
                      strokeWidth={isActive ? 2.5 : 2}
                      className="flex-shrink-0"
                    />
                    <span
                      className={`text-[13px] whitespace-nowrap transition-opacity duration-200 ${
                        isOpen ? 'opacity-100' : 'opacity-0 lg:opacity-0'
                      }`}
                    >
                      {label}
                    </span>
                  </Link>
                ) : (
                  /* ── Expandable parent ──────────────────────────────── */
                  <>
                    <button
                      onClick={() => toggleExpand(item.nameKey)}
                      title={!isOpen ? label : undefined}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                        transition-all duration-150 text-left
                        ${isParentActive
                          ? 'font-medium'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1e1e2c] hover:text-gray-900 dark:hover:text-white'
                        }
                      `}
                      style={
                        isParentActive
                          ? { backgroundColor: 'color-mix(in srgb, var(--ars-primary) 10%, transparent)', color: 'var(--ars-primary)' }
                          : undefined
                      }
                    >
                      <Icon
                        size={17}
                        strokeWidth={isParentActive ? 2.5 : 2}
                        className="flex-shrink-0"
                      />
                      <span
                        className={`flex-1 text-[13px] whitespace-nowrap transition-opacity duration-200 ${
                          isOpen ? 'opacity-100' : 'opacity-0 lg:opacity-0'
                        }`}
                      >
                        {label}
                      </span>
                      {hasSubItems && isOpen && (
                        <span className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </span>
                      )}
                    </button>

                    {/* Sub-items */}
                    {hasSubItems && isExpanded && isOpen && (
                      <div className="ml-7 mt-0.5 space-y-0.5">
                        {item.subItems!
                          .filter((sub) => canAccessRoute(role, sub.href))
                          .map((sub) => {
                            const active = isSubItemActive(sub.href);
                            const subLabel = t(sub.nameKey);
                            return (
                              <Link
                                key={sub.href}
                                to={sub.href}
                                onClick={() =>
                                  window.innerWidth < 1024 && onClose()
                                }
                                className={`
                                  flex items-center gap-2 px-3 py-2 rounded-lg
                                  text-[12px] transition-all duration-150
                                  ${active
                                    ? 'font-medium'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1e1e2c] hover:text-gray-900 dark:hover:text-white'
                                  }
                                `}
                                style={
                                  active
                                    ? { backgroundColor: 'color-mix(in srgb, var(--ars-primary) 10%, transparent)', color: 'var(--ars-primary)' }
                                    : undefined
                                }
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-400 dark:bg-gray-600"
                                  style={active ? { backgroundColor: 'var(--ars-primary)' } : undefined}
                                />
                                {subLabel}
                              </Link>
                            );
                          })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── User footer ──────────────────────────────────────────────── */}
        <div className="p-3 border-t border-gray-200 dark:border-[#262636] flex-shrink-0 overflow-hidden">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1e1e2c] transition-colors group">
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 select-none"
              style={{ backgroundColor: 'var(--ars-primary)' }}
            >
              {initials()}
            </div>

            {/* Name + role (only when expanded) */}
            <div
              className={`flex-1 min-w-0 transition-opacity duration-200 ${
                isOpen ? 'opacity-100' : 'opacity-0 lg:opacity-0'
              }`}
            >
              <p className="text-[12px] font-semibold text-gray-900 dark:text-white truncate leading-tight">
                {displayName()}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                {user?.role?.replace(/_/g, ' ')}
              </p>
            </div>

            {/* Appearance button (only when expanded + hovered) */}
            <button
              onClick={onOpenAppearance}
              title={t('sidebar.appearanceTooltip')}
              className={`
                p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-[#262636] text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200
                transition-all flex-shrink-0
                ${isOpen ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 lg:opacity-0'}
              `}
            >
              <Settings2 size={14} />
            </button>

            {/* Logout button (only when expanded + hovered) */}
            <button
              onClick={logout}
              title={t('sidebar.logoutTooltip')}
              className={`
                p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400
                transition-all flex-shrink-0
                ${isOpen
                  ? 'opacity-0 group-hover:opacity-100'
                  : 'opacity-0 lg:opacity-0'
                }
              `}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}