import { type ColorFormat, formatScaleColor, generateAlphaScale, getSurfaceColor } from './color-utils';
import { CONTRAST_USAGE, type GeneratedPalette, STEP_USAGE, SURFACE_USAGE, generatePaletteScale } from './export-utils';
import { fontKind } from './fonts';
import {
  FONT_WEIGHTS,
  type FontWeightName,
  type Foundations,
  RADIUS_FULL,
  type TypeStyle,
  type ShadowConfig,
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
 *   semantic  — purposes that alias base tokens (bg-brand, text-h1-size, padding-card); text styles and
 *               shadow levels are composites of those (text-h1 of its properties, shadow-md of its color slots)
 * Formatters (CSS, JSON, Figma) only read this model.
 */

export type Tier = 'primitive' | 'base' | 'semantic';
export const TIERS: Tier[] = ['primitive', 'base', 'semantic'];

export type TokenGroup = 'color' | 'typography' | 'spacing' | 'radius' | 'shadow' | 'grid';

export type TokenType = 'color' | 'dimension' | 'number' | 'fontFamily' | 'fontWeight' | 'letterSpacing' | 'shadow' | 'typography';

/** A text style's properties, each the name of the token that holds it. */
export interface TypographyParts {
  family: string;
  size: string;
  lineHeight: string;
  weight: string;
  tracking: string;
}

/** Each property's token, as a suffix on the style's name (`text-h1-line-height`). */
export const TYPOGRAPHY_PARTS: Record<keyof TypographyParts, string> = {
  family: 'family',
  size: 'size',
  lineHeight: 'line-height',
  weight: 'weight',
  tracking: 'tracking',
};

const typographyParts = (style: string) =>
  Object.fromEntries(Object.entries(TYPOGRAPHY_PARTS).map(([k, suffix]) => [k, `${style}-${suffix}`])) as unknown as TypographyParts;

export interface Token {
  tier: Tier;
  group: TokenGroup;
  /** CSS custom property name without the leading dashes. */
  name: string;
  /** Nesting path inside the tier for JSON and Figma. */
  path: string[];
  type: TokenType;
  /** Raw value for primitives: px for dimensions, em for letter spacing. */
  value?: string | number | ShadowLayer[] | TypographyParts;
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
  /** The generator's alias, set when the user re-pointed this token. */
  defaultRef?: string;
  /** On a light primitive when both modes share one set: its dark counterpart. */
  pair?: string;
  /** Added by the user rather than the generator. */
  custom?: boolean;
  /** The text style this token is one property of. */
  partOf?: string;
  /** The alias in each extra product that points somewhere else: base color roles, radius steps, text style families. */
  products?: { product: string; ref: string; darkRef?: string }[];
}

/**
 * A base or semantic token the user added. Its type and dark alias follow the token it points to. One
 * pointing at a text style is a style of its own (text-button), with property tokens that start out as that style's.
 */
export interface CustomToken {
  tier: 'base' | 'semantic';
  group: TokenGroup;
  name: string;
  ref: string;
  description?: string;
  /** Nesting the user typed with slashes (text/ui/demo), whose segments joined by hyphens make the name. */
  path?: string[];
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

// ============================================================
// Products
// ============================================================

/** A product is a mode of the Color collection: the same roles, filled by other palettes. */
export interface Product {
  id: string;
  name: string;
  /** Fonts this product uses instead of the first product's, by font role. */
  fonts?: Partial<Record<FontRole, string>>;
  /** The md radius in px this product uses instead of the first product's. */
  radius?: number;
  /** `brand` tints this product's shadows with its own brand color instead of the shared tint. */
  shadowTint?: 'brand';
}

export type FontRole = 'heading' | 'body' | 'mono';

export const DEFAULT_PRODUCT: Product = { id: 'default', name: 'Main' };

/** The products, the default first. A missing list means just the default one. */
export const productsOf = (f: { products?: Product[] }): Product[] => (f.products?.length ? f.products : [DEFAULT_PRODUCT]);

export const productSlug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product';

/**
 * The palette filling each role in every product, by product id. The first product's roles decide
 * which roles exist; another product can refill any of them, and the rest inherit from the first.
 */
export function resolveProductRoles(palettes: PaletteConfig[], products: Product[]) {
  const base = resolveColorRoles(palettes);
  const baseHolders = new Map([...base].map(([id, role]) => [role, id]));
  const out = new Map<string, Map<ColorRole, { paletteId: string; inherited: boolean }>>();
  products.forEach((product, i) => {
    const roles = new Map<ColorRole, { paletteId: string; inherited: boolean }>();
    for (const role of COLOR_ROLES) {
      const baseId = baseHolders.get(role);
      if (!baseId) continue;
      const own = i === 0 ? undefined : palettes.find((p) => p.productRoles?.[product.id] === role);
      roles.set(role, own ? { paletteId: own.id, inherited: false } : { paletteId: baseId, inherited: i > 0 });
    }
    out.set(product.id, roles);
  });
  return out;
}

/**
 * Fills a role in an extra product with a palette, taking it from the palette that filled it there
 * before. `none` or undefined clears the palette's role in that product, so the role inherits again.
 */
export function withProductRole(palettes: PaletteConfig[], productId: string, id: string, role: ColorRole | 'none' | undefined) {
  // A palette given a role in another product stops being guessed for the first product's roles,
  // so a role it already fills there by name or position is written down to keep it
  const mainRoles = resolveColorRoles(palettes);
  return palettes.map((p) => {
    const current = p.productRoles?.[productId];
    const keep = p.id === id ? role && role !== 'none' && role : current !== role && current;
    const { [productId]: _, ...rest } = p.productRoles ?? {};
    const productRoles = keep ? { ...rest, [productId]: keep } : rest;
    if (current === (keep || undefined)) return p;
    const pinned = keep && !p.tokenRole && mainRoles.get(p.id);
    return {
      ...p,
      ...(pinned && { tokenRole: pinned }),
      productRoles: Object.keys(productRoles).length ? productRoles : undefined,
    };
  });
}

/** A palette's light step 9, whatever mode the editor shows, like the shared tint's Use primary color. */
export const brandSolid = (p: GeneratedPalette) => generatePaletteScale(p, false, p.context).colors[8];

/** Each product's shadow tint: its brand's step 9 when it follows its brand, else the shared tint. */
export function productShadowTints(palettes: GeneratedPalette[], f: Foundations): Map<string, string> {
  const products = productsOf(f);
  const roles = resolveProductRoles(palettes, products);
  const byId = new Map(palettes.map((p) => [p.id, p]));
  return new Map(
    products.map((product, i) => {
      const brand = i > 0 && product.shadowTint === 'brand' ? byId.get(roles.get(product.id)?.get('brand')?.paletteId ?? '') : undefined;
      return [product.id, brand ? brandSolid(brand) : f.shadow.tint];
    }),
  );
}

const BRAND_ROLES: ColorRole[] = ['brand', 'brand-secondary'];

/** Brand roles an extra product still takes from the first product, usually an oversight. */
export function inheritedBrandRoles(palettes: PaletteConfig[], products: Product[]) {
  const resolved = resolveProductRoles(palettes, products);
  return products.slice(1).flatMap((product) =>
    BRAND_ROLES.flatMap((role) => {
      const holder = resolved.get(product.id)?.get(role);
      return holder?.inherited ? [{ product, role, paletteId: holder.paletteId }] : [];
    }),
  );
}

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
  // Palettes picked for another product only fill the first product's roles when asked to
  const guessable = (p: PaletteConfig) => !p.tokenRole && !Object.keys(p.productRoles ?? {}).length;
  const free = (gray: boolean) => palettes.find((p) => (p.role === 'gray') === gray && guessable(p) && !roles.has(p.id));
  for (const [role, gray] of [['brand', false], ['neutral', true]] as const) {
    const p = taken.has(role) ? undefined : free(gray);
    if (p) assign(p, role);
  }
  for (const p of palettes) {
    if (!guessable(p)) continue;
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

const LEADING_ROLES: ColorRole[] = ['brand', 'brand-secondary'];
const roleRank = (role: ColorRole | undefined) => {
  const i = role ? LEADING_ROLES.indexOf(role) : -1;
  return i === -1 ? LEADING_ROLES.length : i;
};

function colorTokens(palettes: GeneratedPalette[], modes: TokenModes, format: ColorFormat, products: Product[]): Token[] {
  const tokens: Token[] = [];
  const primitives = primitiveColorNames(palettes);
  const roles = resolveColorRoles(palettes);
  const productRoles = resolveProductRoles(palettes, products);
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
  // Brand and brand secondary lead the roles; primitives and the other roles keep the app's palette order
  const ordered = [...palettes].sort((a, b) => roleRank(roles.get(a.id)) - roleRank(roles.get(b.id)));
  for (const p of ordered) {
    const role = roles.get(p.id);
    if (!role) continue;
    // Extra products that fill this role with their own palette
    const overrides = products.slice(1).flatMap((product) => {
      const holder = productRoles.get(product.id)?.get(role);
      return holder && !holder.inherited && holder.paletteId !== p.id ? [{ product, paletteId: holder.paletteId }] : [];
    });
    for (const step of steps) {
      tokens.push({
        tier: 'base',
        group: 'color',
        name: `${role}-${step}`,
        path: ['color', role, step],
        type: 'color',
        ref: `${prim(p.id, modes === 'dark')}-${step}`,
        darkRef: modes === 'both' ? `${prim(p.id, true)}-${step}` : undefined,
        products: overrides.length
          ? overrides.map(({ product, paletteId }) => ({
              product: product.name,
              ref: `${prim(paletteId, modes === 'dark')}-${step}`,
              darkRef: modes === 'both' ? `${prim(paletteId, true)}-${step}` : undefined,
            }))
          : undefined,
      });
    }
  }

  // Semantic: purposes on top of roles, skipped when the role isn't assigned
  const present = new Set(roles.values());
  for (const s of [...SEMANTIC_COLORS].sort((a, b) => roleRank(a.role) - roleRank(b.role))) {
    if (!present.has(s.role)) continue;
    tokens.push({
      tier: 'semantic',
      group: 'color',
      name: s.name,
      path: ['color', s.name],
      type: 'color',
      ref: `${s.role}-${s.step}`,
      description: s.usage,
    });
  }
  return tokens;
}

// ============================================================
// Typography
// ============================================================

/** Base size names by scale step: body is md, each step up or down moves one size (…, 2xs, xs, sm, md, lg, xl, 2xl, …). */
const sizeRole = (step: number) =>
  step === 0 ? 'md' : step === 1 ? 'lg' : step === -1 ? 'sm' : step === 2 ? 'xl' : step === -2 ? 'xs' : step > 0 ? `${step - 1}xl` : `${-step - 1}xs`;

/**
 * Type primitives are named by scale step, not by px, so changing the base size or ratio keeps
 * every name: step-0 is body, step-1 one step up, step-n1 one step down. Steps above body also
 * get a `-mobile` primitive for the smaller ratio below the type breakpoint.
 */
/** Base weight names by emphasis; they can't reuse the primitive weight names. */
const WEIGHT_EMPHASIS: Record<FontWeightName, string> = { regular: 'normal', medium: 'emphasis', semibold: 'strong', bold: 'heavy' };

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
  /** One style per scale step — styles on the same step share their size. */
  const bySteps = [...new Map(styles.map((s) => [s.step, s])).entries()].sort(([a], [b]) => a - b);

  // Primitives. Families are named by slot, not by font, so picking another font keeps the name.
  const FAMILY_SLOTS = [
    ['primary', c.headingFamily, fontKind(c.headingFamily)],
    ['secondary', c.bodyFamily, fontKind(c.bodyFamily)],
    ['mono', c.monoFamily, 'mono'],
  ] as const;
  for (const [slot, family, kind] of FAMILY_SLOTS) {
    tokens.push({ tier: 'primitive', group: 'typography', name: `font-family-${slot}`, path: ['font', 'family', slot], type: 'fontFamily', value: fontStack(family, kind) });
  }
  // An extra product's own fonts get the slot plus the product's position (primary-2), never the font's name
  const products = productsOf(f);
  const FONT_ROLE_SLOTS = [
    ['heading', 'primary', c.headingFamily],
    ['body', 'secondary', c.bodyFamily],
    ['mono', 'mono', c.monoFamily],
  ] as const;
  const productFonts = new Map<FontRole, { product: string; ref: string }[]>();
  products.slice(1).forEach((product, i) => {
    for (const [role, slot, base] of FONT_ROLE_SLOTS) {
      const family = product.fonts?.[role];
      if (!family || family === base) continue;
      const name = `font-family-${slot}-${i + 2}`;
      tokens.push({
        tier: 'primitive',
        group: 'typography',
        name,
        path: ['font', 'family', `${slot}-${i + 2}`],
        type: 'fontFamily',
        value: fontStack(family, role === 'mono' ? 'mono' : fontKind(family)),
        description: `${product.name} ${role} font`,
      });
      productFonts.set(role, [...(productFonts.get(role) ?? []), { product: product.name, ref: name }]);
    }
  });
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

  // Base: roles. `code` rather than `mono`, which names the primitive.
  // An extra product's own font is a role of its own, numbered by product like its primitive (heading-2), so Typography keeps
  // only its breakpoint modes; the Text styles switch to it per product.
  const productRoles = new Map<FontRole, { product: string; ref: string }[]>();
  for (const [role, slot, fontRole] of [
    ['heading', 'primary', 'heading'],
    ['body', 'secondary', 'body'],
    ['code', 'mono', 'mono'],
  ] as const) {
    tokens.push({
      tier: 'base',
      group: 'typography',
      name: `font-family-${role}`,
      path: ['font', 'family', role],
      type: 'fontFamily',
      ref: `font-family-${slot}`,
    });
    for (const own of productFonts.get(fontRole) ?? []) {
      const n = products.findIndex((p) => p.name === own.product) + 1;
      const name = `font-family-${role}-${n}`;
      tokens.push({ tier: 'base', group: 'typography', name, path: ['font', 'family', `${role}-${n}`], type: 'fontFamily', ref: own.ref, description: `${own.product} ${role} font` });
      productRoles.set(fontRole, [...(productRoles.get(fontRole) ?? []), { product: own.product, ref: name }]);
    }
  }
  // Base: emphasis levels, so each style's weight aliases a purpose rather than a primitive
  for (const [weight, emphasis] of Object.entries(WEIGHT_EMPHASIS)) {
    tokens.push({ tier: 'base', group: 'typography', name: `font-weight-${emphasis}`, path: ['font', 'weight', emphasis], type: 'fontWeight', ref: `font-weight-${weight}` });
  }

  // Base: a t-shirt size scale, one entry per step. Mobile-first, so the responsive switch lives here.
  /** Points at the mobile primitive and switches to the desktop one from the breakpoint, when they differ. */
  const mobileFirst = (prim: string, step: number, mobileValue: number, desktopValue: number): Partial<Token> => {
    const desktopRef = `${prim}-${stepCode(step)}`;
    return mobileValue === desktopValue
      ? { ref: desktopRef }
      : { ref: `${desktopRef}-mobile`, responsive: [{ minWidth: bp, label: 'desktop', ref: desktopRef }], baseLabel: 'mobile' };
  };
  for (const [step, s] of bySteps) {
    const size = sizeRole(s.step);
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

  // Semantic: one text style per role in the UI. Like a shadow level, the style is a composite whose
  // properties are tokens beside it, so each can be re-pointed and Figma binds to them.
  for (const s of styles) {
    const role = s.role === 'heading' ? 'heading' : 'body';
    const size = sizeRole(s.step);
    const style = `text-${s.name}`;
    const t = (prop: string, type: TokenType, ref: string): Token => ({
      tier: 'semantic',
      group: 'typography',
      name: `${style}-${prop}`,
      path: ['text', s.name, prop],
      type,
      ref,
      description: prop === 'size' ? s.usage : undefined,
      partOf: style,
    });
    tokens.push(
      { tier: 'semantic', group: 'typography', name: style, path: ['text', s.name], type: 'typography', value: typographyParts(style), description: s.usage },
      { ...t('family', 'fontFamily', `font-family-${role}`), products: productRoles.get(role) },
      t('size', 'dimension', `font-size-${size}`),
      t('line-height', 'dimension', `line-height-${size}`),
      t('weight', 'fontWeight', `font-weight-${WEIGHT_EMPHASIS[s.weightName]}`),
      t('tracking', 'letterSpacing', `letter-spacing-${size}`),
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

const SEMANTIC_SPACE: { name: string; role: string; usage: string }[] = [
  { name: 'gap-inline', role: 'xs', usage: 'Between items in a row: icon and label, buttons' },
  { name: 'gap-stack', role: 'md', usage: 'Between stacked items: form fields, list rows' },
  { name: 'gap-section', role: '2xl', usage: 'Between page sections' },
  { name: 'padding-control-x', role: 'md', usage: 'Horizontal padding in buttons and inputs' },
  { name: 'padding-control-y', role: 'xs', usage: 'Vertical padding in buttons and inputs' },
  { name: 'padding-card', role: 'lg', usage: 'Inside cards and panels' },
  { name: 'padding-dialog', role: 'xl', usage: 'Inside dialogs and sheets' },
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
  }));
  for (const [role, m] of SPACE_ROLES) {
    tokens.push({
      tier: 'base',
      group: 'spacing',
      name: `space-${role}`,
      path: ['space', role],
      type: 'dimension',
      ref: scale.find((s) => s.multiplier === m)!.name,
    });
  }
  for (const s of SEMANTIC_SPACE) {
    // Under `space` like the scale and roles, so the user's own (padding-section) sit beside them
    tokens.push({ tier: 'semantic', group: 'spacing', name: s.name, path: ['space', s.name], type: 'dimension', ref: `space-${s.role}`, description: s.usage });
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
  // An extra product's own radius gets the steps that differ, plus the product's position (radius-1-2), like its fonts
  const productRadius = new Map<string, { product: string; ref: string }[]>();
  productsOf(f)
    .slice(1)
    .forEach((product, i) => {
      if (product.radius === undefined || product.radius === f.radius.base) return;
      for (const r of generateRadiusScale({ ...f.radius, base: product.radius })) {
        if (r.value === scale.find((s) => s.name === r.name)!.value) continue;
        const name = `${primName(r)}-${i + 2}`;
        tokens.push({ tier: 'primitive', group: 'radius', name, path: ['radius', name.replace('radius-', '')], type: 'dimension', value: r.value, description: `${product.name} radius` });
        productRadius.set(r.name, [...(productRadius.get(r.name) ?? []), { product: product.name, ref: name }]);
      }
    });
  for (const r of scale) {
    tokens.push({
      tier: 'base',
      group: 'radius',
      name: `radius-${r.name}`,
      path: ['radius', r.name],
      type: 'dimension',
      ref: primName(r),
      description: r.usage,
      products: productRadius.get(r.name),
    });
  }
  for (const [name, role, usage] of SEMANTIC_RADIUS) {
    tokens.push({ tier: 'semantic', group: 'radius', name: `radius-${name}`, path: ['radius', name], type: 'dimension', ref: `radius-${role}`, description: usage });
  }
  return tokens;
}

// ============================================================
// Shadow
// ============================================================

interface ShadowLevelLayers {
  name: string;
  usage: string;
  /** Dark adds a light edge as the first layer. */
  edge: boolean;
  layers: { light: ShadowLayer; dark: ShadowLayer }[];
}

/**
 * Each level's layers with their light and dark colors side by side. Geometry is the same in both
 * modes; dark adds a light edge first, so light gets a clear one to keep the same layers in one style.
 */
function shadowLevelLayers(c: ShadowConfig): ShadowLevelLayers[] {
  const dark = generateShadowScale(c, true);
  return generateShadowScale(c, false).map((level, i) => {
    const d = dark[i].layers;
    const edge = d.length > level.layers.length;
    const light = edge ? [{ ...d[0], color: 'rgb(255 255 255 / 0)' }, ...level.layers] : level.layers;
    return { name: level.name, usage: level.usage, edge, layers: light.map((l, j) => ({ light: l, dark: d[j] })) };
  });
}

/**
 * Each layer's color slot. Layers are counted from the top; a slot every level fills with the same
 * color is shared, and one whose color changes per level (Hard) gets a slot per level.
 */
function shadowSlots(levels: ShadowLevelLayers[]) {
  const slotOf = (level: ShadowLevelLayers, j: number) => (level.edge && j === 0 ? 'edge' : `layer-${level.edge ? j : j + 1}`);
  const colors = new Map<string, Set<string>>();
  for (const level of levels) {
    level.layers.forEach(({ light, dark }, j) => {
      const slot = slotOf(level, j);
      colors.set(slot, (colors.get(slot) ?? new Set()).add(`${light.color}|${dark.color}`));
    });
  }
  return (level: ShadowLevelLayers, j: number) => {
    const slot = slotOf(level, j);
    const shared = colors.get(slot)!.size === 1;
    const layer = slot === 'edge' ? 'Edge that lifts raised surfaces off dark backgrounds, clear in light' : `Layer ${slot.slice(6)}`;
    return {
      key: shared ? slot : `${slot}-${level.name}`,
      path: shared ? [slot] : [slot, level.name],
      description: slot === 'edge' ? layer : `${layer} of ${shared ? 'every shadow' : `shadow ${level.name}`}`,
    };
  };
}

/**
 * Shadows split like colors, so one set of styles follows light, dark and each product:
 *   primitive — each layer's raw color, light and dark side by side (elevation-layer-1, elevation-dark-layer-1),
 *               and a product's own when its tint differs (elevation-layer-1-2)
 *   base      — color slots that switch to dark and per product (shadow-layer-1-color)
 *   semantic  — the levels (shadow-md): each layer's geometry with the slot its color comes from, as a
 *               text style is built from its properties. Purposes are the user's: a custom semantic
 *               token aliasing a level beside it (shadow-toast).
 */
function shadowTokens(palettes: GeneratedPalette[], f: Foundations, modes: TokenModes): Token[] {
  const tokens: Token[] = [];
  const modeList = modes === 'both' ? [false, true] : [modes === 'dark'];
  const darkPart = (isDark: boolean) => (modes === 'both' && isDark ? ['dark'] : []);
  const prim = (key: string, isDark: boolean, suffix = '') => ['elevation', ...darkPart(isDark), `${key}${suffix}`].join('-');

  // The first product's levels, then each product whose tint differs; tint only changes colors
  const tints = productShadowTints(palettes, f);
  const products = productsOf(f);
  const variants = [
    { product: undefined as Product | undefined, suffix: '', levels: shadowLevelLayers(f.shadow) },
    ...products.slice(1).flatMap((product, i) => {
      const tint = tints.get(product.id)!;
      return tint === f.shadow.tint ? [] : [{ product, suffix: `-${i + 2}`, levels: shadowLevelLayers({ ...f.shadow, tint }) }];
    }),
  ];
  const levels = variants[0].levels;
  const slotFor = shadowSlots(levels);
  const slots = new Map<string, ReturnType<typeof slotFor> & { level: number; layer: number }>();
  levels.forEach((level, i) => level.layers.forEach((_, j) => {
    const slot = slotFor(level, j);
    if (!slots.has(slot.key)) slots.set(slot.key, { ...slot, level: i, layer: j });
  }));

  for (const { product, suffix, levels: own } of variants) {
    for (const isDark of modeList) {
      for (const slot of slots.values()) {
        const layer = own[slot.level].layers[slot.layer];
        tokens.push({
          tier: 'primitive',
          group: 'shadow',
          name: prim(slot.key, isDark, suffix),
          path: ['elevation', ...darkPart(isDark), `${slot.key}${suffix}`],
          type: 'color',
          value: (isDark ? layer.dark : layer.light).color,
          description: product ? `${product.name} ${slot.description[0].toLowerCase()}${slot.description.slice(1)}` : slot.description,
          pair: modes === 'both' && !isDark ? prim(slot.key, true, suffix) : undefined,
        });
      }
    }
  }
  for (const slot of slots.values()) {
    const own = variants.slice(1).map(({ product, suffix }) => ({
      product: product!.name,
      ref: prim(slot.key, modes === 'dark', suffix),
      darkRef: modes === 'both' ? prim(slot.key, true, suffix) : undefined,
    }));
    tokens.push({
      tier: 'base',
      group: 'shadow',
      name: `shadow-${slot.key}-color`,
      path: ['shadow', ...slot.path, 'color'],
      type: 'color',
      ref: prim(slot.key, modes === 'dark'),
      darkRef: modes === 'both' ? prim(slot.key, true) : undefined,
      description: slot.description,
      products: own.length ? own : undefined,
    });
  }
  for (const level of levels) {
    tokens.push({
      tier: 'semantic',
      group: 'shadow',
      name: `shadow-${level.name}`,
      path: ['shadow', level.name],
      type: 'shadow',
      // Light colors for previews; colorRef is what each layer's color really is
      value: level.layers.map((l, j) => ({ ...(modes === 'dark' ? l.dark : l.light), colorRef: `shadow-${slotFor(level, j).key}-color` })),
      description: level.usage,
    });
  }
  return tokens;
}

/** A shadow level whose layer colors come from its color slots, here resolved for a mode and product. */
export function resolveShadowLayers(t: Token, byName: Map<string, Token>, isDark = false, product?: string): ShadowLayer[] {
  return ((t.value as ShadowLayer[] | undefined) ?? []).map((l) => {
    const slot = l.colorRef ? byName.get(l.colorRef) : undefined;
    if (!slot) return l;
    const own = product ? slot.products?.find((o) => o.product === product) : undefined;
    const ref = own ? (isDark && own.darkRef) || own.ref : isDark && slot.darkRef ? slot.darkRef : slot.ref;
    const color = ref ? resolveToken(byName.get(ref) ?? slot, byName, isDark)?.value : slot.value;
    return { ...l, color: typeof color === 'string' ? color : l.color };
  });
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
  const page: [string, string, TokenType, string][] = [
    ['page-columns', 'grid-columns', 'number', 'Columns in the page grid'],
    ['page-gutter', 'grid-gutter', 'dimension', 'Gaps between grid columns'],
    ['page-margin', 'grid-margin', 'dimension', 'Space between content and screen edge'],
  ];
  if (g.maxWidth > 0) page.push(['page-max-width', 'container-max', 'dimension', 'Widest the content gets']);
  if (g.sidebar > 0) page.push(['page-sidebar', 'sidebar-width', 'dimension', 'App navigation sidebar']);
  for (const [name, ref, type, usage] of page) {
    tokens.push({ tier: 'semantic', group: 'grid', name, path: ['page', name.replace('page-', '')], type, ref, description: usage });
  }
  return tokens;
}

// ============================================================
// Alias edits
// ============================================================

export const TIER_BELOW: Partial<Record<Tier, Tier>> = { base: 'primitive', semantic: 'base' };

/** Shadow levels are composites in semantic: geometry plus color slots, not an alias. */
const isShadowLevel = (t: Token) => t.group === 'shadow' && t.tier === 'semantic' && t.type === 'shadow' && !t.ref;

/** Text styles are composites in semantic: their properties are the tokens beside them. */
const isTextStyle = (t: Token) => t.group === 'typography' && t.tier === 'semantic' && t.type === 'typography';

/**
 * Whether a token in `tier` may point at `target`: the tier below, or for a semantic shadow or text
 * style a composite beside it (a level, another style).
 */
const canAlias = (tier: Tier, target: Token) =>
  target.tier === TIER_BELOW[tier] || (tier === 'semantic' && (isShadowLevel(target) || isTextStyle(target)));

/** Why a token can't be re-pointed, or null when it can. Primitives, shadow levels and generated text styles are locked. */
export function aliasLock(t: Token): string | null {
  if (t.tier === 'primitive') return 'Raw value — change it in the editor';
  if (isShadowLevel(t)) return 'Built from the shadow settings — change it in the editor';
  return isTextStyle(t) && !t.custom ? 'Built from its properties — re-point those' : null;
}

/**
 * Tokens that a token in `tier` may point to: the tier below, in the same group. When both
 * modes share one set, dark primitives are left out — picking the light one brings its pair.
 */
export function aliasTargets(tier: Tier, group: TokenGroup, tokens: Token[], type?: TokenType): Token[] {
  const below = TIER_BELOW[tier];
  const darkOnly = new Set(tokens.flatMap((t) => (t.pair ? [t.pair] : [])));
  return tokens.filter((o) => (o.tier === below || canAlias(tier, o)) && o.group === group && (!type || o.type === type) && !darkOnly.has(o.name));
}

/** Groups that share a type across families (font size vs line height, gutter vs margin) need a narrower match. */
function family(t: Token): string | undefined {
  if (t.group === 'typography') return t.type === 'typography' ? undefined : t.path[1];
  if (t.group === 'grid') return t.path[0] === 'grid' ? t.path.at(-1) : t.path[0];
  return undefined;
}

/** Targets an existing token can switch to: same type, and same family as the token it pointed to originally. */
export function aliasOptions(t: Token, tokens: Token[]): Token[] {
  const original = tokens.find((o) => o.name === (t.defaultRef ?? t.ref));
  const fam = original && family(original);
  // A text style can't point at itself, or at a style that points at it
  return aliasTargets(t.tier, t.group, tokens, t.type).filter((o) => (!fam || family(o) === fam) && o.name !== t.name && o.ref !== t.name);
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
    if (!target || ref === t.ref || t.custom || aliasLock(t)) return t;
    if (!canAlias(t.tier, target) || target.group !== t.group || target.type !== t.type) return t;
    return { ...pointAt(t, target), defaultRef: t.ref };
  });
}

const CUSTOM_ROOT: Record<TokenGroup, string> = { color: 'color', typography: 'font', spacing: 'space', radius: 'radius', shadow: 'shadow', grid: 'page' };

/**
 * The prefix every generated name in a tier starts with, which the user's own tokens there take too
 * (button → text-button, input → radius-input). Tiers whose names start several ways (gap, padding) have none.
 */
export const NAME_PREFIX: Record<TokenGroup, Partial<Record<'base' | 'semantic', string>>> = {
  color: {},
  typography: { semantic: 'text' },
  spacing: { base: 'space' },
  radius: { base: 'radius', semantic: 'radius' },
  shadow: { base: 'shadow', semantic: 'shadow' },
  grid: { semantic: 'page' },
};

export const isTokenName = (name: string) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);

const within = (a: string[], b: string[]) => a.every((k, i) => b[i] === k);
/** The token in the tier a path would nest into or around, if any. */
const clashing = (path: string[], tier: Tier, tokens: Token[]) => tokens.find((t) => t.tier === tier && (within(path, t.path) || within(t.path, path)));

/**
 * The path typed with slashes, under its root unless typed with it (text/ui/demo, or ui/demo for a text
 * style → text.ui.demo), and the token it would nest into or around, in which case it stays flat.
 */
export function typedPath(c: CustomToken, textStyle: boolean, tokens: Token[]): { path: string[]; clash?: Token } | null {
  if (!c.path) return null;
  const root = textStyle ? 'text' : CUSTOM_ROOT[c.group];
  const path = c.path[0] === root && c.group !== 'color' ? c.path : [root, ...c.path];
  return { path, clash: clashing(path, textStyle ? 'semantic' : c.tier, tokens) };
}

/**
 * A custom token's path: as typed with slashes, else nested like the tokens beside it whose names it
 * continues (`font-size-hero` → `font.size.hero` beside `font-size-md`, `container-narrow` →
 * `container.narrow`), else without the root its name repeats (`shadow-toast` → `shadow.toast`). Color
 * keeps the whole name, since its collection exports name variables by path, and so does a name whose
 * path would nest into or around another token's in the tier (`shadow-edge` beside `shadow.edge.color`).
 * A text style (text-button → text.button) keeps its name when the key is taken.
 */
export function customTokenPath(c: CustomToken, textStyle: boolean, tokens: Token[]): string[] {
  const typed = typedPath(c, textStyle, tokens);
  if (typed && !typed.clash) return typed.path;
  if (textStyle) {
    const key = c.name.startsWith('text-') ? c.name.slice(5) : c.name;
    return ['text', tokens.some((t) => t.tier === 'semantic' && t.path[0] === 'text' && t.path[1] === key) ? c.name : key];
  }
  const root = CUSTOM_ROOT[c.group];
  if (c.group === 'color' || typed) return [root, c.name];
  let stem = c.name.startsWith(`${root}-`) ? root : '';
  let path = stem ? [root, c.name.slice(root.length + 1)] : [root, c.name];
  // The longest name stem a sibling shares (`line-height` of `line-height-md`), and the group it sits in
  for (const t of tokens) {
    const last = t.path.at(-1)!;
    if (t.tier !== c.tier || t.group !== c.group || !t.name.endsWith(`-${last}`)) continue;
    const s = t.name.slice(0, -last.length - 1);
    if (s.length > stem.length && c.name.startsWith(`${s}-`)) {
      stem = s;
      path = [...t.path.slice(0, -1), c.name.slice(s.length + 1)];
    }
  }
  return clashing(path, c.tier, tokens) ? [root, c.name] : path;
}

/**
 * The nesting a custom token's name carries, as the slash-separated end of its path that spells the name
 * (text/ui/demo for text-ui-demo at text.ui.demo, size/hero for size-hero at font.size.hero); null when flat.
 */
export function nestedName(t: Token): string | null {
  for (let i = 0; i < t.path.length - 1; i++) {
    const tail = t.path.slice(i);
    if (tail.join('-') === t.name) return tail.join('/');
  }
  return null;
}

/**
 * A purpose pointing at a text style: a style of its own (text-button → text.button, text/ui/demo → text.ui.demo), whose property
 * tokens start out where the style's point. Re-pointing one, say its weight, is an ordinary alias edit.
 */
function customTextStyle(c: CustomToken, style: Token, tokens: Token[], byName: Map<string, Token>): Token[] {
  const path = customTokenPath(c, true, tokens);
  const parts = typographyParts(c.name);
  const own = (Object.keys(TYPOGRAPHY_PARTS) as (keyof TypographyParts)[]).flatMap((k) => {
    const from = byName.get((style.value as TypographyParts)[k]);
    if (!from) return [];
    const { defaultRef, description, ...rest } = from;
    // The usage goes on the size too, as on generated styles, so the Figma variable carries it
    const usage = k === 'size' && c.description ? { description: c.description } : {};
    return [{ ...rest, ...usage, name: parts[k], path: [...path, TYPOGRAPHY_PARTS[k]], partOf: c.name }];
  });
  return [
    { tier: 'semantic', group: 'typography', name: c.name, path, type: 'typography', ref: style.name, value: parts, description: c.description || undefined, custom: true },
    ...own,
  ];
}

/** Adds the user's tokens, base before semantic so a custom semantic can point at a custom base. Invalid ones are skipped. */
function addCustomTokens(tokens: Token[], custom: CustomToken[] | undefined, groups: TokenGroup[]): Token[] {
  if (!custom?.length) return tokens;
  const out = [...tokens];
  const byName = new Map(out.map((t) => [t.name, t]));
  for (const tier of ['base', 'semantic'] as const) {
    for (const c of custom) {
      if (c.tier !== tier || !groups.includes(c.group) || !isTokenName(c.name) || byName.has(c.name)) continue;
      const target = byName.get(c.ref);
      if (!target || !canAlias(tier, target) || target.group !== c.group) continue;
      if (isTextStyle(target)) {
        const style = customTextStyle(c, target, out, byName);
        if (style.some((t) => byName.has(t.name))) continue;
        out.push(...style);
        for (const t of style) byName.set(t.name, t);
        continue;
      }
      const t: Token = {
        tier,
        group: c.group,
        name: c.name,
        path: customTokenPath(c, false, out),
        type: target.type,
        ref: target.name,
        darkRef: target.pair,
        description: c.description || undefined,
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
    ...(has('color') ? colorTokens(palettes, opts.modes, opts.colorFormat, productsOf(f)) : []),
    ...(has('typography') ? typographyTokens(f) : []),
    ...(has('spacing') ? spacingTokens(f) : []),
    ...(has('radius') ? radiusTokens(f) : []),
    ...(has('shadow') ? shadowTokens(palettes, f, opts.modes) : []),
    ...(has('grid') ? gridTokens(f) : []),
  ], f.aliases);
  // Again after the custom tokens, for edits to the properties of the user's text styles
  return applyAliases(addCustomTokens(generated, f.customTokens, opts.groups), f.aliases);
}

/** Follows aliases down to the primitive, in light or dark mode. */
export function resolveToken(t: Token, byName: Map<string, Token>, isDark = false): Token | undefined {
  let cur: Token | undefined = t;
  for (let i = 0; cur?.ref && i < 4; i++) cur = byName.get(isDark && cur.darkRef ? cur.darkRef : cur.ref);
  return cur;
}

/** A text style's values at the widest breakpoint, each property followed down to its primitive. */
export function resolveTypography(t: Token, byName: Map<string, Token>) {
  const parts = t.value as TypographyParts;
  const at = (k: keyof TypographyParts) => {
    let cur = byName.get(parts[k]);
    for (let i = 0; cur?.ref && i < 4; i++) cur = byName.get(cur.responsive?.at(-1)?.ref ?? cur.ref);
    return cur?.value;
  };
  return { family: String(at('family') ?? ''), size: Number(at('size')), lineHeight: Number(at('lineHeight')), weight: Number(at('weight')), tracking: Number(at('tracking')) };
}

/** Role and primitive name for each palette, for the inspector. */
export function colorTokenInfo(palettes: GeneratedPalette[]) {
  const primitives = primitiveColorNames(palettes);
  const roles = resolveColorRoles(palettes);
  return new Map(palettes.map((p) => [p.id, { primitive: primitives.get(p.id)!, role: roles.get(p.id) }]));
}
