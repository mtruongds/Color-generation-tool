import { type ColorFormat, formatScaleColor, generateAlphaScale, getSurfaceColor } from './color-utils';
import { CONTRAST_USAGE, type GeneratedPalette, STEP_USAGE, SURFACE_USAGE, generatePaletteScale } from './export-utils';
import { fontKind } from './fonts';
import {
  FONT_WEIGHTS,
  type Foundations,
  RADIUS_FULL,
  TYPE_STEPS,
  type TypeStyle,
  type ShadowLayer,
  fontStack,
  generateRadiusScale,
  generateShadowScale,
  generateSpacingScale,
  generateTypeScale,
  sortedBreakpoints,
} from './foundations';
import type { PaletteConfig } from '../components/palette-generator/types';

/*
 * One token model for every export. Tokens come in three tiers:
 *   primitive — raw values, named so a config change never renames them (brand-scale-9, font-size-step-0, space-4)
 *   base      — roles that alias primitives (brand-9, font-family-heading, space-md)
 *   semantic  — purposes that alias base tokens (bg-brand, text-h1-size, padding-card)
 * Formatters (CSS, Tailwind, JSON, Figma) only read this model.
 */

export type Tier = 'primitive' | 'base' | 'semantic';
export const TIERS: Tier[] = ['primitive', 'base', 'semantic'];

export type TokenGroup = 'color' | 'typography' | 'spacing' | 'radius' | 'shadow' | 'grid';

export type TokenType = 'color' | 'dimension' | 'number' | 'fontFamily' | 'fontWeight' | 'letterSpacing' | 'shadow';

export interface Token {
  tier: Tier;
  group: TokenGroup;
  /** CSS custom property name without the leading dashes. */
  name: string;
  /** Nesting path inside the tier for JSON and Figma. */
  path: string[];
  type: TokenType;
  /** Raw value for primitives: px for dimensions, em for letter spacing. */
  value?: string | number | ShadowLayer[];
  /** Name of the token this one aliases. */
  ref?: string;
  /** Alias used in dark mode, when it differs. */
  darkRef?: string;
  /** Mobile-first overrides from a min width up. */
  responsive?: { minWidth: number; label: string; ref: string }[];
  /** Label for the value below the first responsive override, e.g. "mobile". */
  baseLabel?: string;
  /** Wide-gamut color for P3 displays. */
  p3?: string;
  description?: string;
  /** Tailwind v4 theme variable that exposes this token as utilities. */
  tw?: string;
  /** Tailwind needs a literal value here, e.g. breakpoints used in media queries. */
  twLiteral?: boolean;
  /** The generator's alias, set when the user re-pointed this token. */
  defaultRef?: string;
  /** On a light primitive when both modes share one set: its dark counterpart. */
  pair?: string;
  /** Added by the user rather than the generator. */
  custom?: boolean;
}

/** A base or semantic token the user added. Its type and dark alias follow the token it points to. */
export interface CustomToken {
  tier: 'base' | 'semantic';
  group: TokenGroup;
  name: string;
  ref: string;
  description?: string;
}

/** `both` puts light and dark in one set (dark primitives get a `-dark` suffix); a single mode is for Figma. */
export type TokenModes = 'both' | 'light' | 'dark';

// ============================================================
// Color roles
// ============================================================

export const COLOR_ROLES = ['brand', 'brand-secondary', 'neutral', 'info', 'success', 'warning', 'danger'] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

export const ROLE_LABELS: Record<ColorRole, string> = {
  brand: 'Brand · Primary',
  'brand-secondary': 'Brand · Secondary',
  neutral: 'Neutral',
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  danger: 'Danger',
};

const ROLE_HINTS: [RegExp, ColorRole][] = [
  [/green|grass|emerald|jade|teal|mint|lime/i, 'success'],
  [/amber|yellow|orange|gold/i, 'warning'],
  [/red|tomato|crimson|ruby|rose/i, 'danger'],
  [/blue|cyan|sky|info/i, 'info'],
];

/**
 * Which role each palette fills. Each role goes to one palette: explicit choices first, then brand
 * and neutral to the first unassigned accent and gray, then guesses from the palette name.
 */
export function resolveColorRoles(palettes: PaletteConfig[]): Map<string, ColorRole> {
  const roles = new Map<string, ColorRole>();
  const taken = new Set<ColorRole>();
  const assign = (p: PaletteConfig, role: ColorRole) => {
    if (roles.has(p.id) || taken.has(role)) return;
    roles.set(p.id, role);
    taken.add(role);
  };
  for (const p of palettes) if (p.tokenRole && p.tokenRole !== 'none') assign(p, p.tokenRole);
  const free = (gray: boolean) => palettes.find((p) => (p.role === 'gray') === gray && !p.tokenRole && !roles.has(p.id));
  for (const [role, gray] of [['brand', false], ['neutral', true]] as const) {
    const p = taken.has(role) ? undefined : free(gray);
    if (p) assign(p, role);
  }
  for (const p of palettes) {
    if (p.tokenRole) continue;
    const hint = ROLE_HINTS.find(([re]) => re.test(p.name))?.[1];
    if (hint) assign(p, hint);
  }
  return roles;
}

/** Words that name roles or semantic groups, so a primitive can't use them. */
const RESERVED = new Set<string>([...COLOR_ROLES, 'secondary', 'accent', 'bg', 'fg', 'border', 'focus']);

const slug = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Primitive names come from the palette's own name, never from its color, so changing a base
 * color keeps every name. Names that start with a role or semantic word ("Brand", "Success 2")
 * get a `-scale` suffix, so `brand-9` aliases `brand-scale-9` instead of clashing with it.
 */
export function primitiveColorNames(palettes: GeneratedPalette[]): Map<string, string> {
  const names = new Map<string, string>();
  const used = new Set<string>();
  for (const p of palettes) {
    let name = slug(p.name) || 'palette';
    if (RESERVED.has(name.split('-')[0])) name = `${name}-scale`;
    let unique = name;
    for (let n = 2; used.has(unique); n++) unique = `${name}-${n}`;
    used.add(unique);
    names.set(p.id, unique);
  }
  return names;
}

interface SemanticColor {
  name: string;
  role: ColorRole;
  step: string;
  usage: string;
}

const statusColors = (role: ColorRole): SemanticColor[] => [
  { name: `bg-${role}`, role, step: '9', usage: `Solid ${role} backgrounds` },
  { name: `bg-${role}-subtle`, role, step: '3', usage: `Subtle ${role} backgrounds, banners` },
  { name: `fg-${role}`, role, step: '11', usage: `${role[0].toUpperCase() + role.slice(1)} text and icons` },
  { name: `fg-on-${role}`, role, step: 'contrast', usage: `Text on bg-${role}` },
  { name: `border-${role}`, role, step: '7', usage: `${role[0].toUpperCase() + role.slice(1)} borders` },
];

const SEMANTIC_COLORS: SemanticColor[] = [
  { name: 'bg', role: 'neutral', step: '1', usage: 'App background' },
  { name: 'bg-subtle', role: 'neutral', step: '2', usage: 'Sidebars, subtle sections' },
  { name: 'bg-surface', role: 'neutral', step: 'surface', usage: 'Cards and panels over the background' },
  { name: 'bg-muted', role: 'neutral', step: '3', usage: 'Neutral control backgrounds' },
  { name: 'bg-muted-hover', role: 'neutral', step: '4', usage: 'Hovered neutral controls' },
  { name: 'bg-muted-active', role: 'neutral', step: '5', usage: 'Pressed or selected neutral controls' },
  { name: 'border-subtle', role: 'neutral', step: '6', usage: 'Separators, card borders' },
  { name: 'border', role: 'neutral', step: '7', usage: 'Control borders' },
  { name: 'border-strong', role: 'neutral', step: '8', usage: 'Hovered control borders' },
  { name: 'fg-muted', role: 'neutral', step: '11', usage: 'Secondary text and icons' },
  { name: 'fg', role: 'neutral', step: '12', usage: 'Primary text and icons' },
  { name: 'bg-brand', role: 'brand', step: '9', usage: 'Primary buttons, selected states' },
  { name: 'bg-brand-hover', role: 'brand', step: '10', usage: 'Hovered primary buttons' },
  { name: 'bg-brand-subtle', role: 'brand', step: '3', usage: 'Subtle brand backgrounds' },
  { name: 'bg-brand-subtle-hover', role: 'brand', step: '4', usage: 'Hovered subtle brand backgrounds' },
  { name: 'fg-brand', role: 'brand', step: '11', usage: 'Links, brand text and icons' },
  { name: 'fg-on-brand', role: 'brand', step: 'contrast', usage: 'Text on bg-brand' },
  { name: 'border-brand', role: 'brand', step: '7', usage: 'Brand borders' },
  { name: 'focus-ring', role: 'brand', step: '8', usage: 'Focus outlines' },
  { name: 'bg-brand-secondary', role: 'brand-secondary', step: '9', usage: 'Secondary brand buttons and highlights' },
  { name: 'bg-brand-secondary-hover', role: 'brand-secondary', step: '10', usage: 'Hovered secondary brand buttons' },
  { name: 'bg-brand-secondary-subtle', role: 'brand-secondary', step: '3', usage: 'Subtle secondary brand backgrounds' },
  { name: 'bg-brand-secondary-subtle-hover', role: 'brand-secondary', step: '4', usage: 'Hovered subtle secondary brand backgrounds' },
  { name: 'fg-brand-secondary', role: 'brand-secondary', step: '11', usage: 'Secondary brand text and icons' },
  { name: 'fg-on-brand-secondary', role: 'brand-secondary', step: 'contrast', usage: 'Text on bg-brand-secondary' },
  { name: 'border-brand-secondary', role: 'brand-secondary', step: '7', usage: 'Secondary brand borders' },
  ...(['info', 'success', 'warning', 'danger'] as const).flatMap(statusColors),
];

function colorTokens(palettes: GeneratedPalette[], modes: TokenModes, format: ColorFormat): Token[] {
  const tokens: Token[] = [];
  const primitives = primitiveColorNames(palettes);
  const roles = resolveColorRoles(palettes);
  const modeList = modes === 'both' ? [false, true] : [modes === 'dark'];
  /** Dark primitives carry a suffix only when both modes share one file. */
  const prim = (id: string, isDark: boolean) => `${primitives.get(id)}${modes === 'both' && isDark ? '-dark' : ''}`;

  for (const p of palettes) {
    for (const isDark of modeList) {
      const scale = generatePaletteScale(p, isDark, p.context);
      const alpha = generateAlphaScale(scale, isDark);
      const base = prim(p.id, isDark);
      const path = [base];
      const add = (step: string, value: string, p3: string | undefined, description: string) =>
        tokens.push({
          tier: 'primitive',
          group: 'color',
          name: `${base}-${step}`,
          path: ['color', ...path, step],
          type: 'color',
          value,
          p3,
          description,
          pair: modes === 'both' && !isDark ? `${prim(p.id, true)}-${step}` : undefined,
        });

      scale.colors.forEach((_, i) => add(`${i + 1}`, formatScaleColor(scale, i, format), scale.wideGamut[i], STEP_USAGE[i]));
      alpha.colors.forEach((a, i) => add(`a${i + 1}`, a.rgba, scale.alphaWideGamut[i], `${STEP_USAGE[i]} (translucent)`));
      add('contrast', scale.contrast, undefined, CONTRAST_USAGE);
      add('surface', format === 'oklch' ? scale.surfaceWideGamut : getSurfaceColor(scale).rgba, scale.surfaceWideGamut, SURFACE_USAGE);
    }
  }

  // Base: each role aliases its palette, switching to the dark primitive in dark mode
  const steps = [
    ...Array.from({ length: 12 }, (_, i) => `${i + 1}`),
    ...Array.from({ length: 12 }, (_, i) => `a${i + 1}`),
    'contrast',
    'surface',
  ];
  for (const p of palettes) {
    const role = roles.get(p.id);
    if (!role) continue;
    for (const step of steps) {
      tokens.push({
        tier: 'base',
        group: 'color',
        name: `${role}-${step}`,
        path: ['color', role, step],
        type: 'color',
        ref: `${prim(p.id, modes === 'dark')}-${step}`,
        darkRef: modes === 'both' ? `${prim(p.id, true)}-${step}` : undefined,
        tw: `color-${role}-${step}`,
      });
    }
  }

  // Semantic: purposes on top of roles, skipped when the role isn't assigned
  const present = new Set(roles.values());
  for (const s of SEMANTIC_COLORS) {
    if (!present.has(s.role)) continue;
    tokens.push({
      tier: 'semantic',
      group: 'color',
      name: s.name,
      path: ['color', s.name],
      type: 'color',
      ref: `${s.role}-${s.step}`,
      description: s.usage,
      tw: `color-${s.name}`,
    });
  }
  return tokens;
}

// ============================================================
// Typography
// ============================================================

/** Base size names by scale step: body is md, each step up or down moves one size. */
const SIZE_ROLES: Record<number, string> = { [-2]: 'xs', [-1]: 'sm', 0: 'md', 1: 'lg', 2: 'xl', 3: '2xl', 4: '3xl', 5: '4xl', 6: '5xl' };

/**
 * Type primitives are named by scale step, not by px, so changing the base size or ratio keeps
 * every name: step-0 is body, step-1 one step up, step-n1 one step down. Steps above body also
 * get a `-mobile` primitive for the smaller ratio below the type breakpoint.
 */
const stepCode = (step: number) => `step-${step < 0 ? `n${-step}` : step}`;

/** Type sizes step down below this width: the grid's `md`, or the first breakpoint from 768px. */
export function typeBreakpoint(f: Foundations) {
  const list = sortedBreakpoints(f.grid);
  return (list.find((b) => b.name === 'md') ?? list.find((b) => b.minWidth >= 768))?.minWidth ?? 768;
}

function typographyTokens(f: Foundations): Token[] {
  const c = f.typography;
  const styles = generateTypeScale(c);
  const bp = typeBreakpoint(f);
  const tokens: Token[] = [];
  const stepOf = (name: string) => TYPE_STEPS.find((t) => t.name === name)!.step;
  /** One style per scale step — styles on the same step share their size. */
  const bySteps = [...new Map(styles.map((s) => [stepOf(s.name), s])).entries()].sort(([a], [b]) => a - b);

  // Primitives. Families are named by slot, not by font, so picking another font keeps the name.
  const FAMILY_SLOTS = [
    ['primary', c.headingFamily, fontKind(c.headingFamily)],
    ['secondary', c.bodyFamily, fontKind(c.bodyFamily)],
    ['mono', c.monoFamily, 'mono'],
  ] as const;
  for (const [slot, family, kind] of FAMILY_SLOTS) {
    tokens.push({ tier: 'primitive', group: 'typography', name: `font-family-${slot}`, path: ['font', 'family', slot], type: 'fontFamily', value: fontStack(family, kind) });
  }
  for (const [prop, desktop, mobile] of [
    ['size', (s: TypeStyle) => s.size, (s: TypeStyle) => s.mobileSize],
    ['line-height', (s: TypeStyle) => s.lineHeight, (s: TypeStyle) => s.mobileLineHeight],
  ] as const) {
    const name = prop === 'size' ? 'font-size' : 'line-height';
    for (const [step, st] of bySteps) {
      const code = stepCode(step);
      tokens.push({ tier: 'primitive', group: 'typography', name: `${name}-${code}`, path: ['font', prop, code], type: 'dimension', value: desktop(st) });
      if (step > 0) {
        tokens.push({ tier: 'primitive', group: 'typography', name: `${name}-${code}-mobile`, path: ['font', prop, `${code}-mobile`], type: 'dimension', value: mobile(st) });
      }
    }
  }
  for (const [name, weight] of Object.entries(FONT_WEIGHTS)) {
    tokens.push({ tier: 'primitive', group: 'typography', name: `font-weight-${name}`, path: ['font', 'weight', name], type: 'fontWeight', value: weight });
  }
  for (const [step, st] of bySteps) {
    const code = stepCode(step);
    tokens.push({ tier: 'primitive', group: 'typography', name: `letter-spacing-${code}`, path: ['font', 'letter-spacing', code], type: 'letterSpacing', value: st.tracking });
  }

  // Base: roles. `code` rather than `mono`, which names the primitive; Tailwind keeps its familiar font-mono.
  for (const [role, slot, tw] of [
    ['heading', 'primary', 'font-heading'],
    ['body', 'secondary', 'font-body'],
    ['code', 'mono', 'font-mono'],
  ] as const) {
    tokens.push({
      tier: 'base',
      group: 'typography',
      name: `font-family-${role}`,
      path: ['font', 'family', role],
      type: 'fontFamily',
      ref: `font-family-${slot}`,
      tw,
    });
  }
  for (const [role, weight] of [
    ['heading', c.headingWeight],
    ['body', c.bodyWeight],
  ] as const) {
    tokens.push({ tier: 'base', group: 'typography', name: `font-weight-${role}`, path: ['font', 'weight', role], type: 'fontWeight', ref: `font-weight-${weight}` });
  }

  // Base: a t-shirt size scale, one entry per step. Mobile-first, so the responsive switch lives here.
  const sizeRole = (name: string) => SIZE_ROLES[stepOf(name)];
  /** Points at the mobile primitive and switches to the desktop one from the breakpoint, when they differ. */
  const mobileFirst = (prim: string, step: number, mobileValue: number, desktopValue: number): Partial<Token> => {
    const desktopRef = `${prim}-${stepCode(step)}`;
    return mobileValue === desktopValue
      ? { ref: desktopRef }
      : { ref: `${desktopRef}-mobile`, responsive: [{ minWidth: bp, label: 'desktop', ref: desktopRef }], baseLabel: 'mobile' };
  };
  for (const [step, s] of bySteps) {
    const size = sizeRole(s.name);
    tokens.push(
      {
        tier: 'base',
        group: 'typography',
        name: `font-size-${size}`,
        path: ['font', 'size', size],
        type: 'dimension',
        ...mobileFirst('font-size', step, s.mobileSize, s.size),
      },
      {
        tier: 'base',
        group: 'typography',
        name: `line-height-${size}`,
        path: ['font', 'line-height', size],
        type: 'dimension',
        ...mobileFirst('line-height', step, s.mobileLineHeight, s.lineHeight),
      },
      {
        tier: 'base',
        group: 'typography',
        name: `letter-spacing-${size}`,
        path: ['font', 'letter-spacing', size],
        type: 'letterSpacing',
        ref: `letter-spacing-${stepCode(step)}`,
      },
    );
  }

  // Semantic: one text style per role in the UI
  for (const s of styles) {
    const role = s.role === 'heading' ? 'heading' : 'body';
    const size = sizeRole(s.name);
    const t = (prop: string, type: TokenType, ref: string, tw?: string): Token => ({
      tier: 'semantic',
      group: 'typography',
      name: `text-${s.name}-${prop}`,
      path: ['text', s.name, prop],
      type,
      ref,
      tw,
      description: prop === 'size' ? s.usage : undefined,
    });
    tokens.push(
      t('family', 'fontFamily', `font-family-${role}`),
      t('size', 'dimension', `font-size-${size}`, `text-${s.name}`),
      t('line-height', 'dimension', `line-height-${size}`, `text-${s.name}--line-height`),
      t('weight', 'fontWeight', `font-weight-${role}`, `text-${s.name}--font-weight`),
      t('tracking', 'letterSpacing', `letter-spacing-${size}`, `text-${s.name}--letter-spacing`),
    );
  }
  return tokens;
}

// ============================================================
// Spacing
// ============================================================

/** T-shirt roles, as multiples of the base unit. Every progression contains these. */
const SPACE_ROLES: [string, number][] = [
  ['2xs', 1],
  ['xs', 2],
  ['sm', 3],
  ['md', 4],
  ['lg', 6],
  ['xl', 8],
  ['2xl', 12],
  ['3xl', 16],
];

const SEMANTIC_SPACE: { name: string; role: string; tw: string; usage: string }[] = [
  { name: 'gap-inline', role: 'xs', tw: 'spacing-inline', usage: 'Between items in a row: icon and label, buttons' },
  { name: 'gap-stack', role: 'md', tw: 'spacing-stack', usage: 'Between stacked items: form fields, list rows' },
  { name: 'gap-section', role: '2xl', tw: 'spacing-section', usage: 'Between page sections' },
  { name: 'padding-control-x', role: 'md', tw: 'spacing-control-x', usage: 'Horizontal padding in buttons and inputs' },
  { name: 'padding-control-y', role: 'xs', tw: 'spacing-control-y', usage: 'Vertical padding in buttons and inputs' },
  { name: 'padding-card', role: 'lg', tw: 'spacing-card', usage: 'Inside cards and panels' },
  { name: 'padding-dialog', role: 'xl', tw: 'spacing-dialog', usage: 'Inside dialogs and sheets' },
];

function spacingTokens(f: Foundations): Token[] {
  const scale = generateSpacingScale(f.spacing);
  const tokens: Token[] = scale.map((s) => ({
    tier: 'primitive' as const,
    group: 'spacing' as const,
    name: s.name,
    path: ['space', s.name.replace('space-', '')],
    type: 'dimension' as const,
    value: s.value,
    // Tailwind multiplies one base unit for p-1, p-2, …
    ...(s.multiplier === 1 && { tw: 'spacing' }),
  }));
  for (const [role, m] of SPACE_ROLES) {
    tokens.push({
      tier: 'base',
      group: 'spacing',
      name: `space-${role}`,
      path: ['space', role],
      type: 'dimension',
      ref: scale.find((s) => s.multiplier === m)!.name,
      tw: `spacing-${role}`,
    });
  }
  for (const s of SEMANTIC_SPACE) {
    tokens.push({ tier: 'semantic', group: 'spacing', name: s.name, path: ['spacing', s.name], type: 'dimension', ref: `space-${s.role}`, description: s.usage, tw: s.tw });
  }
  return tokens;
}

// ============================================================
// Radius
// ============================================================

const SEMANTIC_RADIUS: [string, string, string][] = [
  ['checkbox', 'xs', 'Checkboxes, small tags'],
  ['badge', 'sm', 'Badges, chips'],
  ['control', 'md', 'Buttons, inputs, selects'],
  ['card', 'lg', 'Cards, panels'],
  ['popover', 'lg', 'Menus, popovers, tooltips'],
  ['dialog', 'xl', 'Dialogs, sheets'],
  ['pill', 'full', 'Pill buttons, segmented controls'],
  ['avatar', 'full', 'Avatars, round icon buttons'],
];

function radiusTokens(f: Foundations): Token[] {
  const scale = generateRadiusScale(f.radius);
  const tokens: Token[] = [];
  // Primitives are named by multiplier of the base (radius-1 is md), so changing the base keeps every name.
  // Full has no multiplier; its fixed 9999px value names it.
  const primName = (r: (typeof scale)[number]) => `radius-${r.value === RADIUS_FULL ? RADIUS_FULL : String(r.multiplier).replace('.', '_')}`;
  for (const r of scale) {
    const name = primName(r);
    tokens.push({ tier: 'primitive', group: 'radius', name, path: ['radius', name.replace('radius-', '')], type: 'dimension', value: r.value });
  }
  for (const r of scale) {
    tokens.push({ tier: 'base', group: 'radius', name: `radius-${r.name}`, path: ['radius', r.name], type: 'dimension', ref: primName(r), description: r.usage, tw: `radius-${r.name}` });
  }
  for (const [name, role, usage] of SEMANTIC_RADIUS) {
    tokens.push({ tier: 'semantic', group: 'radius', name: `radius-${name}`, path: ['radius', name], type: 'dimension', ref: `radius-${role}`, description: usage, tw: `radius-${name}` });
  }
  return tokens;
}

// ============================================================
// Shadow
// ============================================================

const SEMANTIC_SHADOW: [string, string, string][] = [
  ['input', 'xs', 'Inputs and small controls'],
  ['card', 'sm', 'Cards at rest'],
  ['card-hover', 'md', 'Hovered or lifted cards'],
  ['dropdown', 'lg', 'Dropdown menus, selects'],
  ['popover', 'lg', 'Popovers, floating toolbars'],
  ['dialog', 'xl', 'Dialogs and sheets'],
  ['drag', '2xl', 'Items being dragged'],
];

function shadowTokens(f: Foundations, modes: TokenModes): Token[] {
  const tokens: Token[] = [];
  const modeList = modes === 'both' ? [false, true] : [modes === 'dark'];
  const prim = (e: number, isDark: boolean) => `elevation-${modes === 'both' && isDark ? 'dark-' : ''}${e}`;

  for (const isDark of modeList) {
    for (const s of generateShadowScale(f.shadow, isDark)) {
      tokens.push({
        tier: 'primitive',
        group: 'shadow',
        name: prim(s.elevation, isDark),
        path: ['elevation', ...(modes === 'both' && isDark ? ['dark'] : []), `${s.elevation}`],
        type: 'shadow',
        value: s.layers,
        pair: modes === 'both' && !isDark ? prim(s.elevation, true) : undefined,
      });
    }
  }
  for (const s of generateShadowScale(f.shadow, false)) {
    tokens.push({
      tier: 'base',
      group: 'shadow',
      name: `shadow-${s.name}`,
      path: ['shadow', s.name],
      type: 'shadow',
      ref: prim(s.elevation, modes === 'dark'),
      darkRef: modes === 'both' ? prim(s.elevation, true) : undefined,
      description: s.usage,
      tw: `shadow-${s.name}`,
    });
  }
  for (const [name, role, usage] of SEMANTIC_SHADOW) {
    tokens.push({ tier: 'semantic', group: 'shadow', name: `shadow-${name}`, path: ['shadow', name], type: 'shadow', ref: `shadow-${role}`, description: usage, tw: `shadow-${name}` });
  }
  return tokens;
}

// ============================================================
// Layout grid
// ============================================================

function gridTokens(f: Foundations): Token[] {
  const g = f.grid;
  const bps = sortedBreakpoints(g);
  const [first, ...rest] = bps;
  const tokens: Token[] = [];

  for (const b of bps) {
    tokens.push(
      {
        tier: 'primitive',
        group: 'grid',
        name: `breakpoint-${b.name}`,
        path: ['breakpoint', b.name],
        type: 'dimension',
        value: b.minWidth,
        ...(b.minWidth > 0 && { tw: `breakpoint-${b.name}`, twLiteral: true }),
      },
      { tier: 'primitive', group: 'grid', name: `grid-${b.name}-columns`, path: ['grid', b.name, 'columns'], type: 'number', value: b.columns },
      { tier: 'primitive', group: 'grid', name: `grid-${b.name}-gutter`, path: ['grid', b.name, 'gutter'], type: 'dimension', value: b.gutter },
      { tier: 'primitive', group: 'grid', name: `grid-${b.name}-margin`, path: ['grid', b.name, 'margin'], type: 'dimension', value: b.margin },
    );
  }
  if (g.maxWidth > 0) tokens.push({ tier: 'primitive', group: 'grid', name: 'size-container', path: ['size', 'container'], type: 'dimension', value: g.maxWidth });
  if (g.sidebar > 0) tokens.push({ tier: 'primitive', group: 'grid', name: 'size-sidebar', path: ['size', 'sidebar'], type: 'dimension', value: g.sidebar });

  // Base: the current breakpoint's values, swapped by media queries
  for (const [prop, type] of [
    ['columns', 'number'],
    ['gutter', 'dimension'],
    ['margin', 'dimension'],
  ] as const) {
    tokens.push({
      tier: 'base',
      group: 'grid',
      name: `grid-${prop}`,
      path: ['grid', prop],
      type,
      ref: `grid-${first.name}-${prop}`,
      baseLabel: first.name,
      responsive: rest.map((b) => ({ minWidth: b.minWidth, label: b.name, ref: `grid-${b.name}-${prop}` })),
    });
  }
  if (g.maxWidth > 0) tokens.push({ tier: 'base', group: 'grid', name: 'container-max', path: ['container', 'max'], type: 'dimension', ref: 'size-container' });
  if (g.sidebar > 0) {
    tokens.push({ tier: 'base', group: 'grid', name: 'sidebar-width', path: ['sidebar', 'width'], type: 'dimension', ref: 'size-sidebar', description: `Shown from ${g.sidebarFrom} up` });
  }

  // Semantic: page layout
  const page: [string, string, TokenType, string, string?][] = [
    ['page-columns', 'grid-columns', 'number', 'Columns in the page grid'],
    ['page-gutter', 'grid-gutter', 'dimension', 'Gaps between grid columns'],
    ['page-margin', 'grid-margin', 'dimension', 'Space between content and screen edge'],
  ];
  if (g.maxWidth > 0) page.push(['page-max-width', 'container-max', 'dimension', 'Widest the content gets', 'container-page']);
  if (g.sidebar > 0) page.push(['page-sidebar', 'sidebar-width', 'dimension', 'App navigation sidebar']);
  for (const [name, ref, type, usage, tw] of page) {
    tokens.push({ tier: 'semantic', group: 'grid', name, path: ['page', name.replace('page-', '')], type, ref, description: usage, tw });
  }
  return tokens;
}

// ============================================================
// Alias edits
// ============================================================

export const TIER_BELOW: Partial<Record<Tier, Tier>> = { base: 'primitive', semantic: 'base' };

/** Why a token can't be re-pointed, or null when it can. Only primitives are locked. */
export function aliasLock(t: Token): string | null {
  return t.tier === 'primitive' ? 'Raw value — change it in the editor' : null;
}

/**
 * Tokens that a token in `tier` may point to: the tier below, in the same group. When both
 * modes share one set, dark primitives are left out — picking the light one brings its pair.
 */
export function aliasTargets(tier: Tier, group: TokenGroup, tokens: Token[], type?: TokenType): Token[] {
  const below = TIER_BELOW[tier];
  const darkOnly = new Set(tokens.flatMap((t) => (t.pair ? [t.pair] : [])));
  return tokens.filter((o) => o.tier === below && o.group === group && (!type || o.type === type) && !darkOnly.has(o.name));
}

/** Groups that share a type across families (font size vs line height, gutter vs margin) need a narrower match. */
function family(t: Token): string | undefined {
  if (t.group === 'typography') return t.path[1];
  if (t.group === 'grid') return t.path[0] === 'grid' ? t.path.at(-1) : t.path[0];
  return undefined;
}

/** Targets an existing token can switch to: same type, and same family as the token it pointed to originally. */
export function aliasOptions(t: Token, tokens: Token[]): Token[] {
  const original = tokens.find((o) => o.name === (t.defaultRef ?? t.ref));
  const fam = original && family(original);
  return aliasTargets(t.tier, t.group, tokens, t.type).filter((o) => !fam || family(o) === fam);
}

/** Re-points one token, keeping its dark pair. Picking one target replaces per-breakpoint values. */
function pointAt(t: Token, target: Token): Token {
  const next: Token = { ...t, ref: target.name };
  if (t.darkRef) next.darkRef = target.pair ?? target.name;
  if (t.responsive) {
    delete next.responsive;
    delete next.baseLabel;
  }
  return next;
}

/** Re-points edited tokens. Edits whose target no longer exists fall back to the generator's alias. */
function applyAliases(tokens: Token[], aliases: Record<string, string> | undefined): Token[] {
  if (!aliases || Object.keys(aliases).length === 0) return tokens;
  const byName = new Map(tokens.map((t) => [t.name, t]));
  return tokens.map((t) => {
    const ref = aliases[t.name];
    const target = ref ? byName.get(ref) : undefined;
    if (!target || ref === t.ref || aliasLock(t)) return t;
    if (target.tier !== TIER_BELOW[t.tier] || target.group !== t.group || target.type !== t.type) return t;
    return { ...pointAt(t, target), defaultRef: t.ref };
  });
}

/** Tailwind theme variable for a custom token, in the namespace its group uses. */
function customTw(c: CustomToken): string | undefined {
  const prefixed = (ns: string) => (c.name.startsWith(`${ns}-`) ? c.name : `${ns}-${c.name}`);
  switch (c.group) {
    case 'color':
      return `color-${c.name}`;
    case 'spacing':
      return `spacing-${c.name}`;
    case 'radius':
      return prefixed('radius');
    case 'shadow':
      return prefixed('shadow');
    default:
      return undefined;
  }
}

const CUSTOM_ROOT: Record<TokenGroup, string> = { color: 'color', typography: 'font', spacing: 'space', radius: 'radius', shadow: 'shadow', grid: 'page' };

export const isTokenName = (name: string) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);

/** Adds the user's tokens, base before semantic so a custom semantic can point at a custom base. Invalid ones are skipped. */
function addCustomTokens(tokens: Token[], custom: CustomToken[] | undefined, groups: TokenGroup[]): Token[] {
  if (!custom?.length) return tokens;
  const out = [...tokens];
  const byName = new Map(out.map((t) => [t.name, t]));
  for (const tier of ['base', 'semantic'] as const) {
    for (const c of custom) {
      if (c.tier !== tier || !groups.includes(c.group) || !isTokenName(c.name) || byName.has(c.name)) continue;
      const target = byName.get(c.ref);
      if (!target || target.tier !== TIER_BELOW[tier] || target.group !== c.group) continue;
      const t: Token = {
        tier,
        group: c.group,
        name: c.name,
        path: [CUSTOM_ROOT[c.group], c.name],
        type: target.type,
        ref: target.name,
        darkRef: target.pair,
        description: c.description || undefined,
        tw: customTw(c),
        custom: true,
      };
      out.push(t);
      byName.set(t.name, t);
    }
  }
  return out;
}

// ============================================================
// Build
// ============================================================

export function buildTokens(
  palettes: GeneratedPalette[],
  f: Foundations,
  opts: { groups: TokenGroup[]; modes: TokenModes; colorFormat: ColorFormat },
): Token[] {
  const has = (g: TokenGroup) => opts.groups.includes(g);
  const generated = applyAliases([
    ...(has('color') ? colorTokens(palettes, opts.modes, opts.colorFormat) : []),
    ...(has('typography') ? typographyTokens(f) : []),
    ...(has('spacing') ? spacingTokens(f) : []),
    ...(has('radius') ? radiusTokens(f) : []),
    ...(has('shadow') ? shadowTokens(f, opts.modes) : []),
    ...(has('grid') ? gridTokens(f) : []),
  ], f.aliases);
  return addCustomTokens(generated, f.customTokens, opts.groups);
}

/** Follows aliases down to the primitive, in light or dark mode. */
export function resolveToken(t: Token, byName: Map<string, Token>, isDark = false): Token | undefined {
  let cur: Token | undefined = t;
  for (let i = 0; cur?.ref && i < 4; i++) cur = byName.get(isDark && cur.darkRef ? cur.darkRef : cur.ref);
  return cur;
}

/** Role and primitive name for each palette, for the inspector. */
export function colorTokenInfo(palettes: GeneratedPalette[]) {
  const primitives = primitiveColorNames(palettes);
  const roles = resolveColorRoles(palettes);
  return new Map(palettes.map((p) => [p.id, { primitive: primitives.get(p.id)!, role: roles.get(p.id) }]));
}
