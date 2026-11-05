import { PaletteGenerator } from './components/palette-generator/PaletteGenerator';
import { PreviewWindow } from './components/foundations/PreviewWindow';
import { isPreviewPopout } from './lib/preview-window';
import { EDIT_MODE_KEY, type EditMode, loadEditMode } from './lib/edit-mode';
import { Toaster } from 'sonner';
import { useState, useEffect, useLayoutEffect } from 'react';

/** The interface's own theme: the app chrome, not the tokens being edited. */
export type InterfaceTheme = 'system' | 'light' | 'dark';

const THEME_KEY = 'lumina_theme';

function loadTheme(): InterfaceTheme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Blocked storage falls back to the system theme.
  }
  return 'system';
}

function useSystemDark() {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
}

export default function App() {
  const [popout] = useState(isPreviewPopout);
  const [theme, setTheme] = useState<InterfaceTheme>(loadTheme);
  const systemDark = useSystemDark();

  // A preview window shows the mode being edited, and follows it as the editor switches
  const [popoutMode, setPopoutMode] = useState<EditMode>(loadEditMode);
  useEffect(() => {
    if (!popout) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === EDIT_MODE_KEY) setPopoutMode(loadEditMode());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [popout]);

  const isDarkMode = popout ? popoutMode === 'dark' : theme === 'system' ? systemDark : theme === 'dark';

  // Theme lives on <html> so portalled UI (dropdowns, dialogs, tooltips) rendered under <body> picks it up too
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    try {
      if (theme === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Blocked storage only forgets the choice.
    }
  }, [theme]);

  return (
    <>
      {popout ? (
        <PreviewWindow isDarkMode={isDarkMode} />
      ) : (
        <PaletteGenerator interfaceDark={isDarkMode} theme={theme} onThemeChange={setTheme} />
      )}
      <Toaster
        theme={isDarkMode ? 'dark' : 'light'}
        position="bottom-center"
        toastOptions={{ duration: 1800 }}
      />
    </>
  );
}
