import { useEffect } from 'react';
import { X, Sun, Moon, Monitor, ArrowRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useThemeStore, ThemeMode, LayoutMode, DirectionMode } from '../../lib/theme-store';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../../lib/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

const COLORS = [
  { name: 'Bleu', hex: '#3B82F6' },
  { name: 'Émeraude', hex: '#10B981' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Rose', hex: '#EC4899' },
  { name: 'Rouge', hex: '#d52b36' },
];

const SidebarSVG = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.2" />
    <line x1="5" y1="1.5" x2="5" y2="13.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const HorizontalSVG = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.2" />
    <line x1="1.5" y1="5" x2="13.5" y2="5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

export default function AppearanceDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const primaryColor = useThemeStore((s) => s.primaryColor);
  const layout = useThemeStore((s) => s.layout);
  const direction = useThemeStore((s) => s.direction);
  const language = useThemeStore((s) => s.language);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setPrimaryColor = useThemeStore((s) => s.setPrimaryColor);
  const setLayout = useThemeStore((s) => s.setLayout);
  const setDirection = useThemeStore((s) => s.setDirection);
  const setLanguage = useThemeStore((s) => s.setLanguage);

  const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
    fr: 'Français',
    en: 'English',
    ar: 'العربية',
    zh: '中文',
  };

  // Keep <html> classes correct while the dialog is open (in case the
  // global useApplyTheme hook hasn't fired yet on first paint).
  useEffect(() => {
    if (open && typeof window !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
        root.classList.toggle('light', !prefersDark);
      } else {
        root.classList.toggle('dark', theme === 'dark');
        root.classList.toggle('light', theme === 'light');
      }
    }
  }, [open, theme]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-[440px] mx-4 bg-ars-dialog border border-ars-border rounded-[18px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-base font-semibold text-ars-text m-0">{t('appearance.title')}</h2>
          <button onClick={onClose} className="appearance-btn w-8 h-8 p-0 flex items-center justify-center">
            <X size={14} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="px-6 pt-4 pb-6 max-h-[65vh] overflow-y-auto space-y-6">
          {/* THEME */}
          <div>
            <p className="text-sm font-medium text-ars-text mb-3">{t('appearance.theme')}</p>
            <div className="grid grid-cols-3 gap-3">
              {([
                { value: 'light', label: t('appearance.themeLight'), Icon: Sun },
                { value: 'dark', label: t('appearance.themeDark'), Icon: Moon },
                { value: 'system', label: t('appearance.themeSystem'), Icon: Monitor },
              ] as const).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value as ThemeMode)}
                  className={theme === value ? 'appearance-btn appearance-btn-active' : 'appearance-btn'}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* PRIMARY COLOR */}
          <div>
            <p className="text-sm font-medium text-ars-text mb-3">{t('appearance.primaryColor')}</p>
            <div className="flex items-center gap-3">
              {COLORS.map((c) => (
                <button
                  key={c.hex}
                  title={c.name}
                  onClick={() => setPrimaryColor(c.hex)}
                  className="w-10 h-10 rounded-full transition-transform"
                  style={{
                    background: c.hex,
                    border: primaryColor === c.hex ? '2px solid rgba(255,255,255,0.85)' : '2px solid transparent',
                    transform: primaryColor === c.hex ? 'scale(1.12)' : 'scale(1)',
                    boxShadow: primaryColor === c.hex ? `0 0 12px ${c.hex}99` : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {/* LAYOUT */}
          <div>
            <p className="text-sm font-medium text-ars-text mb-3">{t('appearance.layout')}</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'sidebar', label: t('appearance.layoutSidebar'), Icon: SidebarSVG },
                { value: 'horizontal', label: t('appearance.layoutHorizontal'), Icon: HorizontalSVG },
              ] as const).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setLayout(value as LayoutMode)}
                  className={layout === value ? 'appearance-btn appearance-btn-active' : 'appearance-btn'}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* DIRECTION */}
          <div>
            <p className="text-sm font-medium text-ars-text mb-3">{t('appearance.direction')}</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'ltr', label: 'LTR', Icon: ArrowRight },
                { value: 'rtl', label: 'RTL', Icon: ArrowLeft },
              ] as const).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setDirection(value as DirectionMode)}
                  className={direction === value ? 'appearance-btn appearance-btn-active' : 'appearance-btn'}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* LANGUAGE */}
          <div>
            <p className="text-sm font-medium text-ars-text mb-3">{t('appearance.language')}</p>
            <div className="grid grid-cols-2 gap-3">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={language === lang ? 'appearance-btn appearance-btn-active' : 'appearance-btn'}
                >
                  {LANGUAGE_LABELS[lang]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <button onClick={onClose} className="appearance-btn w-full">
            {t('appearance.close')}
          </button>
        </div>
      </div>
    </div>
  );
}