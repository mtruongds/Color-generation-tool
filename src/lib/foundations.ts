import chroma from 'chroma-js';
import type { CustomToken } from './tokens';

/*
 * Non-color foundations: typography, spacing, radius, shadow (elevation) and layout grid.
 * Each one is a small config the inspector edits, plus a pure generator that turns it into tokens.
 */

// ============================================================
// Typography
// ============================================================

export const FONT_WEIGHTS = { regular: 400, medium: 500, semibold: 600, bold: 700 } as const;
export type FontWeightName = keyof typeof FONT_WEIGHTS;

export interface TypographyConfig {
  headingFamily: string;
  bodyFamily: string;
  monoFamily: string;
  /** Body size in px. Every other step is base × ratio^step. */
  baseSize: number;
  ratio: number;
  /** Ratio used below the md breakpoint, so large headings step down on small screens. */
  mobileRatio: number;
  headingWeight: FontWeightName;
  bodyWeight: FontWeightName;
  /** Line heights snap to this grid in px. */
  lineHeightGrid: number;
  /** Tightens large sizes and opens up small ones. */
  opticalTracking: boolean;
}

export type TypeRole = 'heading' | 'body';

export const TYPE_STEPS: { name: string; label: string; step: number; role: TypeRole; usage: string }[] = [
  { name: 'display', label: 'Display', step: 6, role: 'heading', usage: 'Hero and marketing headlines' },
  { name: 'h1', label: 'Heading 1', step: 5, role: 'heading', usage: 'Page titles' },
  { name: 'h2', label: 'Heading 2', step: 4, role: 'heading', usage: 'Section titles' },
  { name: 'h3', label: 'Heading 3', step: 3, role: 'heading', usage: 'Subsection titles' },
  { name: 'h4', label: 'Heading 4', step: 2, role: 'heading', usage: 'Card and dialog titles' },
  { name: 'h5', label: 'Heading 5', step: 1, role: 'heading', usage: 'Group labels, small titles' },
  { name: 'body-lg', label: 'Body large', step: 1, role: 'body', usage: 'Lead paragraphs' },
  { name: 'body', label: 'Body', step: 0, role: 'body', usage: 'Default text' },
  { name: 'body-sm', label: 'Body small', step: -1, role: 'body', usage: 'Secondary text, dense UI' },
  { name: 'caption', label: 'Caption', step: -2, role: 'body', usage: 'Labels, metadata, footnotes' },
];

export const TYPE_RATIOS = [
  { value: 1.067, label: 'Minor second' },
  { value: 1.125, label: 'Major second' },
  { value: 1.2, label: 'Minor third' },
  { value: 1.25, label: 'Major third' },
  { value: 1.333, label: 'Perfect fourth' },
  { value: 1.414, label: 'Augmented fourth' },
  { value: 1.5, label: 'Perfect fifth' },
  { value: 1.618, label: 'Golden ratio' },
];

export interface TypeStyle {
  name: string;
  label: string;
  role: TypeRole;
  usage: string;
  family: string;
  weight: number;
  weightName: FontWeightName;
  /** Desktop values, px. */
  size: number;
  lineHeight: number;
  /** Below md, px. Equal to the desktop values for body sizes. */
  mobileSize: number;
  mobileLineHeight: number;
  /** em */
  tracking: number;
}

/** Larger text needs less leading. */
function lineHeightRatio(size: number) {
  if (size <= 14) return 1.45;
  if (size <= 18) return 1.5;
  if (size <= 24) return 1.35;
  if (size <= 36) return 1.25;
  return 1.1;
}

function snapLineHeight(size: number, grid: number) {
  const raw = size * lineHeightRatio(size);
  const snapped = grid > 0 ? Math.round(raw / grid) * grid : Math.round(raw);
  return Math.max(snapped, Math.ceil(size));
}

/** Roughly follows Inter's dynamic metrics: +0.01em at 12px, -0.025em from ~45px. */
function trackingFor(size: number) {
  const t = 0.01 - 0.0012 * (size - 12);
  return Math.round(Math.min(0.01, Math.max(-0.025, t)) * 1000) / 1000;
}

/** Sizes below body step down at half the ratio, so captions stay readable on large ratios. */
const stepExponent = (step: number) => (step < 0 ? step / 2 : step);

export function generateTypeScale(c: TypographyConfig): TypeStyle[] {
  return TYPE_STEPS.map((s) => {
    const size = Math.round(c.baseSize * Math.pow(c.ratio, stepExponent(s.step)));
    // Only steps above body shrink on mobile
    const mobileSize = s.step > 0 ? Math.round(c.baseSize * Math.pow(c.mobileRatio, s.step)) : size;
    const weightName = s.role === 'heading' ? c.headingWeight : c.bodyWeight;
    return {
      name: s.name,
      label: s.label,
      role: s.role,
      usage: s.usage,
      family: s.role === 'heading' ? c.headingFamily : c.bodyFamily,
      weight: FONT_WEIGHTS[weightName],
      weightName,
      size,
      lineHeight: snapLineHeight(size, c.lineHeightGrid),
      mobileSize,
      mobileLineHeight: snapLineHeight(mobileSize, c.lineHeightGrid),
      tracking: c.opticalTracking ? trackingFor(size) : 0,
    };
  });
}

/** CSS font stack for a family picked in the inspector. */
export function fontStack(family: string, kind: 'sans' | 'serif' | 'mono' = 'sans') {
  if (family === 'System UI') return 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  const fallback =
    kind === 'mono' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : kind === 'serif' ? 'ui-serif, Georgia, serif' : 'ui-sans-serif, system-ui, sans-serif';
  return `"${family}", ${fallback}`;
}

// ============================================================
// Spacing
// ============================================================

export type SpacingProgression = 'linear' | 'geometric';

export interface SpacingConfig {
  /** Base unit in px. Token `space-1` equals one unit. */
  base: number;
  progression: SpacingProgression;
}

const SPACING_MULTIPLIERS: Record<SpacingProgression, number[]> = {
  // Dense at the small end, like Tailwind
  linear: [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
  // Each step roughly 1.5× the last, for looser layouts
  geometric: [0, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32],
};

export interface SpacingToken {
  name: string;
  multiplier: number;
  value: number;
}

/** Primitives are named by multiplier, not px, so changing the base keeps every name: space-4 is 4 × base. */
export const spacingTokenName = (multiplier: number) => `space-${String(multiplier).replace('.', '_')}`;

export function generateSpacingScale(c: SpacingConfig): SpacingToken[] {
  return SPACING_MULTIPLIERS[c.progression].map((m) => {
    const value = Math.round(m * c.base * 100) / 100;
    return { name: spacingTokenName(m), multiplier: m, value };
  });
}

// ============================================================
// Radius
// ============================================================

export interface RadiusConfig {
  /** The `md` radius in px, used by buttons and inputs. */
  base: number;
}

const RADIUS_STEPS = [
  { name: 'none', multiplier: 0, usage: 'Tables, full-bleed media' },
  { name: 'xs', multiplier: 0.25, usage: 'Checkboxes, tags' },
  { name: 'sm', multiplier: 0.5, usage: 'Badges, small controls' },
  { name: 'md', multiplier: 1, usage: 'Buttons, inputs, menus' },
  { name: 'lg', multiplier: 1.5, usage: 'Cards, popovers' },
  { name: 'xl', multiplier: 2, usage: 'Dialogs, sheets' },
  { name: '2xl', multiplier: 3, usage: 'Large panels, hero media' },
  { name: 'full', multiplier: Infinity, usage: 'Pills, avatars' },
];

export const RADIUS_PRESETS = [
  { label: 'Sharp', base: 2 },
  { label: 'Subtle', base: 4 },
  { label: 'Soft', base: 8 },
  { label: 'Round', base: 12 },
];

export interface RadiusToken {
  name: string;
  /** Of the md base. Infinity for full. */
  multiplier: number;
  value: number;
  usage: string;
}

export const RADIUS_FULL = 9999;

/** Radius for an element inset by `padding` inside a rounded parent, so both curves share a center. */
export const nestedRadius = (outer: number, padding: number) => Math.max(0, outer - padding);

export function generateRadiusScale(c: RadiusConfig): RadiusToken[] {
  return RADIUS_STEPS.map((s) => ({
    name: s.name,
    multiplier: s.multiplier,
    usage: s.usage,
    value: s.multiplier === Infinity ? RADIUS_FULL : Math.round(c.base * s.multiplier),
  }));
}

// ============================================================
// Shadow (elevation)
// ============================================================

export type ShadowStyle = 'crisp' | 'soft' | 'diffuse' | 'hard';

export const SHADOW_STYLES: { value: ShadowStyle; label: string; hint: string }[] = [
  { value: 'crisp', label: 'Crisp', hint: 'Two tight layers and a hairline edge, like product UI' },
  { value: 'soft', label: 'Soft', hint: 'Three layers that fade out smoothly' },
  { value: 'diffuse', label: 'Diffuse', hint: 'Four wide, low-opacity layers that feel airy' },
  { value: 'hard', label: 'Hard', hint: 'Solid offset with no blur, for a flat, graphic look' },
];

export interface ShadowConfig {
  style: ShadowStyle;
  /** Multiplies every layer's opacity. */
  intensity: number;
  /** Shadows mix toward this color instead of pure black. */
  tint: string;
  /** 0 = black, 1 = fully tinted. */
  tintStrength: number;
  /** Degrees from straight down. Negative leans left. */
  lightAngle: number;
}

export const SHADOW_LEVELS = [
  { name: 'xs', elevation: 1, usage: 'Inputs, subtle lift' },
  { name: 'sm', elevation: 2, usage: 'Buttons, cards at rest' },
  { name: 'md', elevation: 4, usage: 'Cards on hover, dropdowns' },
  { name: 'lg', elevation: 8, usage: 'Popovers, floating toolbars' },
  { name: 'xl', elevation: 16, usage: 'Dialogs, sheets' },
  { name: '2xl', elevation: 24, usage: 'Drag previews, top-most layers' },
];

export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}

export interface ShadowToken {
  name: string;
  elevation: number;
  usage: string;
  layers: ShadowLayer[];
  css: string;
}

/** Shadow geometry snaps to half pixels. */
const half = (n: number) => Math.round(n * 2) / 2 || 0;

export function shadowColor(c: ShadowConfig, alpha: number) {
  // Mixing in RGB keeps the tint subtle; OKLCH would keep the tint's full chroma at low lightness
  const [r, g, b] = chroma.mix('#000000', c.tint, c.tintStrength, 'rgb').rgb();
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 1000) / 1000;
  return `rgb(${r} ${g} ${b} / ${a})`;
}

export const layerToCss = (l: ShadowLayer) => `${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${l.color}`;

/** Dark surfaces need much stronger shadows to read at all. */
const DARK_ALPHA_BOOST = 4;
/** On dark UI a faint light edge separates raised surfaces better than shadow alone. */
const DARK_EDGE = { x: 0, y: 0, blur: 0, spread: 1, color: 'rgb(255 255 255 / 0.06)' };

export function generateShadowScale(c: ShadowConfig, isDark: boolean): ShadowToken[] {
  const boost = isDark ? DARK_ALPHA_BOOST : 1;
  const lean = Math.sin((c.lightAngle * Math.PI) / 180);

  return SHADOW_LEVELS.map((level) => {
    const e = level.elevation;
    const layers: ShadowLayer[] = isDark && c.style !== 'hard' ? [DARK_EDGE] : [];
    const push = (y: number, blur: number, spread: number, alpha: number) =>
      layers.push({
        x: half(-y * lean),
        y: half(y),
        blur: half(blur),
        spread: half(spread),
        color: shadowColor(c, alpha * c.intensity * boost),
      });

    switch (c.style) {
      case 'crisp':
        push(0, 0, 1, 0.05); // hairline edge
        push(e * 0.5, e, 0, 0.06);
        push(e, e * 2, -e * 0.25, 0.08);
        break;
      case 'soft':
        for (let j = 1; j <= 3; j++) {
          const t = j / 3;
          push(e * t, e * 2 * t, -e * 0.15 * t, 0.09 - 0.015 * j);
        }
        break;
      case 'diffuse':
        for (let j = 1; j <= 4; j++) {
          const t = Math.pow(2, j - 4);
          push(e * 1.5 * t, e * 4 * t, 0, 0.045);
        }
        break;
      case 'hard':
        push(Math.max(1, e * 0.5), 0, 0, 0.18 + Math.min(e, 16) * 0.006);
        break;
    }

    return { name: level.name, elevation: e, usage: level.usage, layers, css: layers.map(layerToCss).join(', ') };
  });
}

// ============================================================
// Layout grid
// ============================================================

export interface Breakpoint {
  name: string;
  /** px, inclusive */
  minWidth: number;
  columns: number;
  gutter: number;
  margin: number;
}

export interface GridConfig {
  breakpoints: Breakpoint[];
  /** Content cap in px. 0 means fluid. */
  maxWidth: number;
  /** Fixed sidebar width in px, applied from `sidebarFrom` up. 0 means none. */
  sidebar: number;
  sidebarFrom: string;
}

export const GRID_PRESETS: { label: string; hint: string; breakpoints: Breakpoint[]; maxWidth: number }[] = [
  {
    label: 'Adaptive',
    hint: '4 → 8 → 12 columns, like Material',
    maxWidth: 1280,
    breakpoints: [
      { name: 'xs', minWidth: 0, columns: 4, gutter: 16, margin: 16 },
      { name: 'sm', minWidth: 576, columns: 8, gutter: 16, margin: 24 },
      { name: 'md', minWidth: 768, columns: 8, gutter: 24, margin: 32 },
      { name: 'lg', minWidth: 992, columns: 12, gutter: 24, margin: 32 },
      { name: 'xl', minWidth: 1200, columns: 12, gutter: 24, margin: 40 },
      { name: 'xxl', minWidth: 1400, columns: 12, gutter: 32, margin: 48 },
    ],
  },
  {
    label: 'Bootstrap',
    hint: '12 columns at every breakpoint',
    maxWidth: 1320,
    breakpoints: [
      { name: 'xs', minWidth: 0, columns: 12, gutter: 24, margin: 12 },
      { name: 'sm', minWidth: 576, columns: 12, gutter: 24, margin: 12 },
      { name: 'md', minWidth: 768, columns: 12, gutter: 24, margin: 12 },
      { name: 'lg', minWidth: 992, columns: 12, gutter: 24, margin: 12 },
      { name: 'xl', minWidth: 1200, columns: 12, gutter: 24, margin: 12 },
      { name: 'xxl', minWidth: 1400, columns: 12, gutter: 24, margin: 12 },
    ],
  },
  {
    label: 'Tailwind',
    hint: 'Tailwind’s default screens, 12 columns',
    maxWidth: 1536,
    breakpoints: [
      { name: 'xs', minWidth: 0, columns: 4, gutter: 16, margin: 16 },
      { name: 'sm', minWidth: 640, columns: 8, gutter: 16, margin: 24 },
      { name: 'md', minWidth: 768, columns: 8, gutter: 24, margin: 32 },
      { name: 'lg', minWidth: 1024, columns: 12, gutter: 24, margin: 32 },
      { name: 'xl', minWidth: 1280, columns: 12, gutter: 32, margin: 48 },
      { name: '2xl', minWidth: 1536, columns: 12, gutter: 32, margin: 64 },
    ],
  },
];

export function sortedBreakpoints(c: GridConfig) {
  return [...c.breakpoints].sort((a, b) => a.minWidth - b.minWidth);
}

export function breakpointAt(c: GridConfig, viewport: number): Breakpoint {
  const list = sortedBreakpoints(c);
  return [...list].reverse().find((b) => viewport >= b.minWidth) ?? list[0];
}

export interface GridLayout {
  breakpoint: Breakpoint;
  sidebar: number;
  /** Width of the content area the columns divide, after sidebar, margins and the cap. */
  content: number;
  column: number;
  /** Left offset of the content area inside the viewport. */
  offset: number;
}

export function computeGridLayout(c: GridConfig, viewport: number): GridLayout {
  const breakpoint = breakpointAt(c, viewport);
  const sidebarFrom = c.breakpoints.find((b) => b.name === c.sidebarFrom)?.minWidth ?? Infinity;
  const sidebar = c.sidebar > 0 && viewport >= sidebarFrom ? c.sidebar : 0;
  const available = viewport - sidebar - breakpoint.margin * 2;
  const content = Math.max(0, c.maxWidth > 0 ? Math.min(available, c.maxWidth) : available);
  const column = Math.max(0, (content - breakpoint.gutter * (breakpoint.columns - 1)) / breakpoint.columns);
  const offset = sidebar + (viewport - sidebar - content) / 2;
  return { breakpoint, sidebar, content, column, offset };
}

// ============================================================
// All foundations
// ============================================================

export interface Foundations {
  typography: TypographyConfig;
  spacing: SpacingConfig;
  radius: RadiusConfig;
  shadow: ShadowConfig;
  grid: GridConfig;
  /** Base and semantic tokens re-pointed by the user: token name → the token it now aliases. */
  aliases?: Record<string, string>;
  /** Base and semantic tokens the user added. */
  customTokens?: CustomToken[];
}

export const DEFAULT_FOUNDATIONS: Foundations = {
  typography: {
    headingFamily: 'Inter',
    bodyFamily: 'Inter',
    monoFamily: 'JetBrains Mono',
    baseSize: 16,
    ratio: 1.25,
    mobileRatio: 1.2,
    headingWeight: 'semibold',
    bodyWeight: 'regular',
    lineHeightGrid: 4,
    opticalTracking: true,
  },
  spacing: { base: 4, progression: 'linear' },
  radius: { base: 8 },
  shadow: { style: 'soft', intensity: 1, tint: '#3e63dd', tintStrength: 0.15, lightAngle: 0 },
  grid: {
    breakpoints: GRID_PRESETS[0].breakpoints,
    maxWidth: GRID_PRESETS[0].maxWidth,
    sidebar: 240,
    sidebarFrom: 'lg',
  },
};

export type FoundationKey = 'color' | Exclude<keyof Foundations, 'aliases' | 'customTokens'>;

/** Fills gaps in saved or imported foundations so older saves keep working. */
export function normalizeFoundations(raw: unknown): Foundations {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Foundations>;
  const merge = <K extends keyof Foundations>(key: K): Foundations[K] => ({
    ...DEFAULT_FOUNDATIONS[key],
    ...(r[key] && typeof r[key] === 'object' ? r[key] : {}),
  });
  const grid = merge('grid');
  if (!Array.isArray(grid.breakpoints) || grid.breakpoints.length === 0) grid.breakpoints = DEFAULT_FOUNDATIONS.grid.breakpoints;
  return {
    typography: merge('typography'),
    spacing: merge('spacing'),
    radius: merge('radius'),
    shadow: merge('shadow'),
    grid,
    aliases: normalizeAliases(r.aliases),
    customTokens: normalizeCustomTokens(r.customTokens),
  };
}

function normalizeCustomTokens(raw: unknown): CustomToken[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is CustomToken =>
        !!c && typeof c === 'object' && (c.tier === 'base' || c.tier === 'semantic') && typeof c.group === 'string' && typeof c.name === 'string' && typeof c.ref === 'string',
    )
    .map((c) => ({ ...c, ref: renameRoles(c.ref) }));
}

/** Renamed color roles: primary became brand (primary-9 → brand-9), secondary became brand-secondary (bg-secondary → bg-brand-secondary). */
const renameRoles = (name: string) =>
  name
    .replace(/^primary-(\d+|a\d+|contrast|surface)$/, 'brand-$1')
    .replace(/^secondary-(\d+|a\d+|contrast|surface)$/, 'brand-secondary-$1')
    .replace(/^(bg|fg-on|fg|border)-secondary(-subtle)?$/, '$1-brand-secondary$2');

function normalizeAliases(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([, v]) => typeof v === 'string')
      .map(([k, v]) => [renameRoles(k), renameRoles(v as string)]),
  );
}

// ============================================================
// Resolved tokens for previews
// ============================================================

export interface Accent {
  solid: string;
  contrast: string;
  subtle: string;
  text: string;
}

export interface ResolvedFoundations {
  type: Record<string, TypeStyle>;
  /** px for a spacing multiplier, e.g. space(4) = 16 with a 4px base. */
  space: (multiplier: number) => number;
  radius: Record<string, number>;
  shadow: Record<string, string>;
  /** Font stack for code. */
  mono: string;
}

export function resolveFoundations(f: Foundations, isDark: boolean): ResolvedFoundations {
  return {
    type: Object.fromEntries(generateTypeScale(f.typography).map((s) => [s.name, s])),
    space: (m) => m * f.spacing.base,
    radius: Object.fromEntries(generateRadiusScale(f.radius).map((r) => [r.name, r.value])),
    shadow: Object.fromEntries(generateShadowScale(f.shadow, isDark).map((s) => [s.name, s.css])),
    mono: fontStack(f.typography.monoFamily, 'mono'),
  };
}
