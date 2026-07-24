import { useEffect } from 'react';
import { useThemeStore } from '../lib/theme-store';

/**
 * Applies theme (light/dark/system), primary color, and text direction
 * to <html>. Call once, near the root of the app (App.tsx).
 */
export function useApplyTheme() {
  const theme = useThemeStore((s) => s.theme);
  const primaryColor = useThemeStore((s) => s.primaryColor);
  const direction = useThemeStore((s) => s.direction);
  const language = useThemeStore((s) => s.language);

  useEffect(() => {
    const root = document.documentElement;

    const applyMode = () => {
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
        root.classList.toggle('light', !prefersDark);
      } else {
        root.classList.toggle('dark', theme === 'dark');
        root.classList.toggle('light', theme === 'light');
      }
    };

    applyMode();

    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', applyMode);
      return () => mql.removeEventListener('change', applyMode);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--ars-primary', primaryColor);
  }, [primaryColor]);

  useEffect(() => {
    document.documentElement.setAttribute('dir', direction);
  }, [direction]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
  }, [language]);
}