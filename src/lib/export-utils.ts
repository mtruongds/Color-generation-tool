import {
  ColorScale,
  DEFAULT_BACKGROUNDS,
  DEFAULT_GRAY,
  ScaleOptions,
  generateScale,
} from './color-utils';
import type { PaletteConfig } from '../components/palette-generator/types';

/** Settings shared by every palette, like the Radix custom page background and gray. */
export interface ScaleContext {
  backgrounds: { light: string; dark: string };
  grayColor: string;
}

export const DEFAULT_SCALE_CONTEXT: ScaleContext = {
  backgrounds: { ...DEFAULT_BACKGROUNDS },
  grayColor: DEFAULT_GRAY,
};

export type GeneratedPalette = PaletteConfig & { scale: ColorScale; context: ScaleContext };

/** The gray of the first gray-role palette tints pure black/white accents. */
export function getScaleContext(palettes: PaletteConfig[], backgrounds: ScaleContext['backgrounds']): ScaleContext {
  const gray = palettes.find((p) => p.role === 'gray');
  return { backgrounds, grayColor: gray?.baseColor ?? DEFAULT_GRAY };
}

export function scaleOptionsFor(p: PaletteConfig, isDark: boolean, context: ScaleContext): ScaleOptions {
  return {
    hueShift: p.hueShift,
    saturationScale: p.saturationScale,
    lockStep9: p.lockStep9,
    role: p.role ?? 'accent',
    background: isDark ? context.backgrounds.dark : context.backgrounds.light,
    grayColor: context.grayColor,
  };
}

export function generatePaletteScale(p: PaletteConfig, isDark: boolean, context: ScaleContext): ColorScale {
  return generateScale(p.baseColor, p.name, isDark, scaleOptionsFor(p, isDark, context));
}

export const toTokenName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, '-') || 'color';

/** Light tokens read `tomato-1`, dark tokens `tomato-dark-1`. */
export const modeTokenName = (name: string, isDark: boolean) =>
  `${toTokenName(name)}${isDark ? '-dark' : ''}`;

export function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const CONTRAST_USAGE = 'Text and icons on step 9 solid backgrounds';
export const SURFACE_USAGE = 'Translucent panel and card backgrounds';

/** Radix step roles — shared by the editor ramp labels and the docs table. */
export const STEP_USAGE = [
  'App background',
  'Subtle background',
  'UI element background',
  'Hovered UI element background',
  'Active / selected UI element background',
  'Subtle borders and separators',
  'UI element border and focus rings',
  'Hovered UI element border',
  'Solid backgrounds (buttons, badges)',
  'Hovered solid backgrounds',
  'Low-contrast text, secondary icons',
  'High-contrast text, primary icons',
];

export const STEP_GROUPS = [
  { label: 'Backgrounds', span: 2 },
  { label: 'Interactive', span: 3 },
  { label: 'Borders', span: 3 },
  { label: 'Solid', span: 2 },
  { label: 'Text', span: 2 },
];
