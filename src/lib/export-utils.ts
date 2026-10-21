import {
  AlphaColor,
  ColorScale,
  DEFAULT_BACKGROUNDS,
  DEFAULT_GRAY,
  ScaleOptions,
  generateAlphaScale,
  generateScale,
  getStepDescription,
  getSurfaceColor,
  hexToOklch,
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

function alphaToOklch(alpha: AlphaColor): string {
  const hex = `#${[alpha.r, alpha.g, alpha.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const alphaValue =
    alpha.alpha === 1 ? '1' : alpha.alpha.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return hexToOklch(hex).replace(')', ` / ${alphaValue})`);
}

const escapeCsv = (field: string) =>
  /[",\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;

/**
 * Primitive color rows, light then `-dark`, one value per row — ready to paste into Google Sheets.
 * `primitiveName` maps a palette to its primitive token name (e.g. indigo).
 */
export function generateSheetCsv(palettes: GeneratedPalette[], primitiveName: (p: GeneratedPalette) => string) {
  const headers = ['Name', 'Mode: Base', 'OKLCH', 'Palette Name', 'Step', 'Type', 'Description', 'Collection Name'];
  let csv = headers.join(',') + '\n';
  const row = (fields: string[]) => [...fields, 'Color'].map(escapeCsv).join(',') + '\n';

  palettes.forEach((p) => {
    const context = p.context ?? DEFAULT_SCALE_CONTEXT;
    [false, true].forEach((isDark) => {
      const scale = generatePaletteScale(p, isDark, context);
      const alpha = generateAlphaScale(scale, isDark);
      const surface = getSurfaceColor(scale);
      const tokenBase = `${primitiveName(p)}${isDark ? '-dark' : ''}`;

      scale.colors.forEach((color, i) => {
        const step = i + 1;
        csv += row([
          `${tokenBase}/${step}`, color, scale.wideGamut[i],
          p.name, `${step}`, 'Color', getStepDescription(step, p.name, false),
        ]);
      });
      alpha.colors.forEach((a, i) => {
        const step = i + 1;
        csv += row([
          `${tokenBase}/a${step}`, a.rgba, alphaToOklch(a),
          p.name, `a${step}`, 'Color', getStepDescription(step, p.name, true),
        ]);
      });
      csv += row([
        `${tokenBase}/contrast`, scale.contrast, hexToOklch(scale.contrast),
        p.name, 'contrast', 'Color', CONTRAST_USAGE,
      ]);
      csv += row([
        `${tokenBase}/surface`, surface.rgba, alphaToOklch(surface),
        p.name, 'surface', 'Color', SURFACE_USAGE,
      ]);
    });
  });

  return csv;
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
