import { useEffect, useMemo, useState } from 'react';
import { generatePaletteScale, getScaleContext } from '../../lib/export-utils';
import { useGoogleFonts } from '../../lib/fonts';
import {
  BACKGROUNDS_KEY,
  FOUNDATIONS_KEY,
  PALETTES_KEY,
  loadBackgrounds,
  loadFoundations,
  loadPalettes,
} from '../palette-generator/PaletteGenerator';
import { PreviewSection } from './PreviewSection';

/**
 * The preview on its own, for a second window. It re-reads palettes, backgrounds and foundations
 * whenever the editor window saves them, so every change shows up here as it's made.
 */
export function PreviewWindow({ isDarkMode }: { isDarkMode: boolean }) {
  const [palettes, setPalettes] = useState(loadPalettes);
  const [backgrounds, setBackgrounds] = useState(loadBackgrounds);
  const [foundations, setFoundations] = useState(loadFoundations);

  useEffect(() => {
    document.title = 'Preview · Lumina';
    // `storage` only fires for writes made by another window, which is exactly the editor
    const onStorage = (e: StorageEvent) => {
      if (e.key === PALETTES_KEY) setPalettes(loadPalettes());
      else if (e.key === BACKGROUNDS_KEY) setBackgrounds(loadBackgrounds());
      else if (e.key === FOUNDATIONS_KEY) setFoundations(loadFoundations());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const { headingFamily, bodyFamily, monoFamily } = foundations.typography;
  useGoogleFonts([headingFamily, bodyFamily, monoFamily]);

  const generatedPalettes = useMemo(() => {
    const context = getScaleContext(palettes, backgrounds);
    return palettes.map((p) => ({ ...p, isDark: isDarkMode, context, scale: generatePaletteScale(p, isDarkMode, context) }));
  }, [palettes, backgrounds, isDarkMode]);

  return (
    <main className="scrollbar-thin h-dvh overflow-y-auto bg-background text-foreground">
      <div className="px-4 py-6 sm:px-6 md:px-8">
        <PreviewSection palettes={generatedPalettes} foundations={foundations} isDark={isDarkMode} popout />
      </div>
    </main>
  );
}
