import { useEffect } from 'react';
import { findCustomFont } from './custom-fonts';

export type FontKind = 'sans' | 'serif' | 'mono';

/** Google Fonts offered in the typography inspector, plus the platform system font. */
export const FONT_OPTIONS: { family: string; kind: FontKind }[] = [
  { family: 'Inter', kind: 'sans' },
  { family: 'System UI', kind: 'sans' },
  { family: 'Geist', kind: 'sans' },
  { family: 'DM Sans', kind: 'sans' },
  { family: 'Manrope', kind: 'sans' },
  { family: 'Plus Jakarta Sans', kind: 'sans' },
  { family: 'IBM Plex Sans', kind: 'sans' },
  { family: 'Be Vietnam Pro', kind: 'sans' },
  { family: 'Space Grotesk', kind: 'sans' },
  { family: 'Fraunces', kind: 'serif' },
  { family: 'Playfair Display', kind: 'serif' },
  { family: 'Source Serif 4', kind: 'serif' },
  { family: 'Lora', kind: 'serif' },
  { family: 'JetBrains Mono', kind: 'mono' },
  { family: 'Geist Mono', kind: 'mono' },
  { family: 'IBM Plex Mono', kind: 'mono' },
  { family: 'Fira Code', kind: 'mono' },
];

export const isBuiltInFont = (family: string) => FONT_OPTIONS.some((f) => f.family.toLowerCase() === family.trim().toLowerCase());

export const fontKind = (family: string): FontKind =>
  FONT_OPTIONS.find((f) => f.family === family)?.kind ?? findCustomFont(family)?.kind ?? 'sans';

/** Already in index.html, or not a web font. */
const PRELOADED = new Set(['Inter', 'JetBrains Mono', 'System UI']);

/** Adds a Google Fonts stylesheet for each family the first time it's needed. */
export function useGoogleFonts(families: string[]) {
  const key = families.join('|');
  useEffect(() => {
    for (const family of new Set(families)) {
      // Uploaded fonts aren't on Google Fonts, and their names shouldn't leave the browser
      if (PRELOADED.has(family) || !isBuiltInFont(family)) continue;
      const id = `gf-${family.replace(/\s+/g, '-').toLowerCase()}`;
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;
      document.head.appendChild(link);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
