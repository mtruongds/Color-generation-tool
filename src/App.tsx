import { PaletteGenerator } from './components/palette-generator/PaletteGenerator';
import { PreviewWindow } from './components/foundations/PreviewWindow';
import { isPreviewPopout } from './lib/preview-window';
import { Toaster } from 'sonner';
import { useState, useEffect, useLayoutEffect, useCallback } from 'react';

export default function App() {
  const [popout] = useState(isPreviewPopout);

  const [themeSource, setThemeSource] = useState<'system' | 'manual'>(() => {
    return localStorage.getItem('lumina_theme') ? 'manual' : 'system';
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('lumina_theme');
    if (saved) return saved === 'dark';
    // Default to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (themeSource !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [themeSource]);

  // A preview window follows the editor's light/dark choice as it changes
  useEffect(() => {
    if (!popout) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'lumina_theme') return;
      if (e.newValue) {
        setThemeSource('manual');
        setIsDarkMode(e.newValue === 'dark');
      } else {
        setThemeSource('system');
        setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [popout]);

  // Theme lives on <html> so portalled UI (dropdowns, dialogs, tooltips) rendered under <body> picks it up too
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // Persist manual choice
  useEffect(() => {
    if (themeSource === 'manual') {
      localStorage.setItem('lumina_theme', isDarkMode ? 'dark' : 'light');
    }
  }, [isDarkMode, themeSource]);

  const toggleDarkMode = useCallback(() => {
    setThemeSource('manual');
    setIsDarkMode(prev => !prev);
  }, []);

  return (
    <>
      {popout ? (
        <PreviewWindow isDarkMode={isDarkMode} />
      ) : (
        <PaletteGenerator isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
      )}
      <Toaster
        theme={isDarkMode ? 'dark' : 'light'}
        position="bottom-center"
        toastOptions={{ duration: 1800 }}
      />
    </>
  );
}