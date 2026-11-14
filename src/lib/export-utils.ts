import {
  ColorScale,
  DEFAULT_BACKGROUNDS,
  DEFAULT_GRAY,
  ScaleOptions,
  applyStepOverrides,
  deriveCounterpartStep,
  generateScale,
  isOverridableStep,
  normalizeHex,
} from './color-utils';
import type { PaletteConfig, StepMap, StepOverrides } from '../components/palette-generator/types';

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

type Mode = 'light' | 'dark';
const otherModeOf = (mode: Mode): Mode => (mode === 'light' ? 'dark' : 'light');

/** Steps of a mode that follow the other mode's hand-set color: set there, not here, and not unsynced. */
export function syncedSteps(o: StepOverrides | undefined, mode: Mode): number[] {
  const own = o?.[mode] ?? {};
  const other = o?.[otherModeOf(mode)] ?? {};
  const unsync = o?.unsync ?? [];
  return Object.keys(other)
    .map(Number)
    .filter((s) => isOverridableStep(s) && !!other[s] && !own[s] && !unsync.includes(s))
    .sort((a, b) => a - b);
}

/**
 * The palette's scale for a mode, with its hand-set steps in place of generated ones. Synced steps
 * set only in the other mode are derived from that color, with the same tint on this mode's step.
 */
export function generatePaletteScale(p: PaletteConfig, isDark: boolean, context: ScaleContext): ColorScale {
  const mode: Mode = isDark ? 'dark' : 'light';
  const scale = generateScale(p.baseColor, p.name, isDark, scaleOptionsFor(p, isDark, context));
  const steps: StepMap = { ...p.stepOverrides?.[mode] };
  const synced = syncedSteps(p.stepOverrides, mode);
  if (synced.length) {
    const other = p.stepOverrides![otherModeOf(mode)]!;
    const otherScale = generateScale(p.baseColor, p.name, !isDark, scaleOptionsFor(p, !isDark, context));
    for (const s of synced) steps[s] = deriveCounterpartStep(other[s]!, otherScale.colors[s - 1], scale.colors[s - 1]);
  }
  const result = applyStepOverrides(scale, steps, isDark, p.role ?? 'accent');
  return synced.length ? { ...result, synced } : result;
}

/** Pins a step in a mode, synced to the other mode by default. A step that already follows the other mode is left alone. */
export function pinStepOverride(o: StepOverrides | undefined, mode: Mode, step: number, hex: string): StepOverrides {
  if (o?.[mode]?.[step] || syncedSteps(o, mode).includes(step)) return o ?? {};
  return tidyStepOverrides({
    ...o,
    [mode]: { ...o?.[mode], [step]: hex },
    unsync: (o?.unsync ?? []).filter((s) => s !== step),
  })!;
}

/** Drops empty maps and unsync entries that no longer point at a hand-set step, so "no overrides" is undefined. */
export function tidyStepOverrides(o: StepOverrides): StepOverrides | undefined {
  const out: StepOverrides = {};
  if (o.light && Object.keys(o.light).length) out.light = o.light;
  if (o.dark && Object.keys(o.dark).length) out.dark = o.dark;
  const unsync = [...new Set(o.unsync ?? [])].filter((s) => out.light?.[s] || out.dark?.[s]).sort((a, b) => a - b);
  if (unsync.length) out.unsync = unsync;
  return out.light || out.dark ? out : undefined;
}

/** Drops steps that can't be set (9, out of range) and values that aren't hex, from saved or imported data. */
export function sanitizeStepOverrides(raw: unknown): StepOverrides | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: StepOverrides = {};
  for (const mode of ['light', 'dark'] as const) {
    const map = (raw as Record<string, unknown>)[mode];
    if (!map || typeof map !== 'object') continue;
    const clean: StepMap = {};
    for (const [step, value] of Object.entries(map)) {
      const hex = typeof value === 'string' ? normalizeHex(value) : null;
      if (hex && isOverridableStep(Number(step))) clean[Number(step)] = hex;
    }
    if (Object.keys(clean).length) out[mode] = clean;
  }
  const unsync = (raw as { unsync?: unknown }).unsync;
  if (Array.isArray(unsync)) out.unsync = unsync.filter((s): s is number => typeof s === 'number' && isOverridableStep(s));
  return tidyStepOverrides(out);
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
