import { create } from 'zustand';
import i18n, { RTL_LANGUAGES, SupportedLanguage } from './i18n';

export type ThemeMode = 'light' | 'dark' | 'system';
export type LayoutMode = 'sidebar' | 'horizontal';
export type DirectionMode = 'ltr' | 'rtl';

interface ThemeState {
  theme: ThemeMode;
  primaryColor: string;
  layout: LayoutMode;
  direction: DirectionMode;
  language: SupportedLanguage;
  setTheme: (theme: ThemeMode) => void;
  setPrimaryColor: (color: string) => void;
  setLayout: (layout: LayoutMode) => void;
  setDirection: (direction: DirectionMode) => void;
  setLanguage: (lang: SupportedLanguage) => void;
}

const STORAGE_KEY = 'ars-appearance';

interface PersistedAppearance {
  theme: ThemeMode;
  primaryColor: string;
  layout: LayoutMode;
  direction: DirectionMode;
  language: SupportedLanguage;
}

const DEFAULTS: PersistedAppearance = {
  theme: 'system',
  primaryColor: '#d52b36',
  layout: 'sidebar',
  direction: 'ltr',
  language: 'fr',
};

function loadInitial(): PersistedAppearance {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme ?? DEFAULTS.theme,
      primaryColor: parsed.primaryColor ?? DEFAULTS.primaryColor,
      layout: parsed.layout ?? DEFAULTS.layout,
      direction: parsed.direction ?? DEFAULTS.direction,
      language: parsed.language ?? DEFAULTS.language,
    };
  } catch {
    return DEFAULTS;
  }
}

function persist(partial: Partial<PersistedAppearance>) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current = raw ? JSON.parse(raw) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
  } catch {
    // ignore write errors (private browsing, quota, etc.)
  }
}

const initial = loadInitial();
i18n.changeLanguage(initial.language);

export const useThemeStore = create<ThemeState>((set) => ({
  ...initial,
  setTheme: (theme) => {
    persist({ theme });
    set({ theme });
  },
  setPrimaryColor: (primaryColor) => {
    persist({ primaryColor });
    set({ primaryColor });
  },
  setLayout: (layout) => {
    persist({ layout });
    set({ layout });
  },
  setDirection: (direction) => {
    persist({ direction });
    set({ direction });
  },
  setLanguage: (language) => {
    persist({ language });
    i18n.changeLanguage(language);
    const naturalDirection = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
    persist({ direction: naturalDirection });
    set({ language, direction: naturalDirection });
  },
}));