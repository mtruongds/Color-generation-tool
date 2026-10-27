import chroma from 'chroma-js';
import type { ColorFormat } from './color-utils';
import type { GeneratedPalette } from './export-utils';
import { type Foundations, type ShadowLayer, layerToCss } from './foundations';
import {
  TIERS,
  type Token,
  type TokenGroup,
  type TypographyParts,
  buildTokens,
  productSlug,
  productsOf,
  resolveShadowLayers,
  resolveToken,
} from './tokens';

export { typeBreakpoint } from './tokens';

export type LengthUnit = 'px' | 'rem';

/** Which part of the system an export covers. */
export type ExportScope = 'all' | TokenGroup;

const ALL_GROUPS: TokenGroup[] = ['color', 'typography', 'spacing', 'radius', 'shadow', 'grid'];
const groupsFor = (scope: ExportScope) => (scope === 'all' ? ALL_GROUPS : [scope]);

const ROOT_FONT_SIZE = 16;

const trim = (n: number, digits = 4) => String(Math.round(n * 10 ** digits) / 10 ** digits);

export const formatLength = (px: number, unit: LengthUnit) =>
  px === 0 ? '0' : unit === 'rem' ? `${trim(px / ROOT_FONT_SIZE)}rem` : `${trim(px, 2)}px`;

const TIER_TITLES: Record<Token['tier'], string> = {
  primitive: 'Primitive — raw values. Reference these only from base tokens.',
  base: 'Base — roles. Each aliases a primitive; dark mode swaps them under [data-theme="dark"].',
  semantic: 'Semantic — purposes. Use these in components.',
};

/** Raw primitive value as CSS. Shadows and letter spacing ignore the unit; a text style is a `font` shorthand of its properties. */
function cssValue(t: Token, unit: LengthUnit): string {
  switch (t.type) {
    case 'dimension':
      // 9999px stays px so pills stay round whatever the unit
      return (t.value as number) >= 9999 ? '9999px' : formatLength(t.value as number, unit);
    case 'letterSpacing':
      return t.value === 0 ? '0' : `${t.value}em`;
    case 'shadow':
      // Each layer's color is its slot's variable, so levels follow dark mode and products
      return (t.value as ShadowLayer[]).map((l) => layerToCss(l.colorRef ? { ...l, color: `var(--${l.colorRef})` } : l)).join(', ');
    case 'typography': {
      const p = t.value as TypographyParts;
      return `var(--${p.weight}) var(--${p.size})/var(--${p.lineHeight}) var(--${p.family})`;
    }
    default:
      return String(t.value);
  }
}

/** Every CSS export switches to dark values under this, on <html>, next to `data-product`. */
const DARK_SELECTOR = '[data-theme="dark"]';

/** A text style that points at another is still built from its own properties, which may differ. */
const decl = (t: Token, unit: LengthUnit, indent = '  ') =>
  `${indent}--${t.name}: ${t.ref && t.type !== 'typography' ? `var(--${t.ref})` : cssValue(t, unit)};`;

const GROUP_LABEL: Record<TokenGroup, string> = {
  color: 'Color',
  typography: 'Typography',
  spacing: 'Spacing',
  radius: 'Radius',
  shadow: 'Shadow',
  grid: 'Layout grid',
};

/** The three tiers as custom properties, with dark and responsive overrides after each tier. */
function variablesCss(tokens: Token[], unit: LengthUnit) {
  const out: string[] = [];
  for (const tier of TIERS) {
    const inTier = tokens.filter((t) => t.tier === tier);
    if (!inTier.length) continue;
    const lines: string[] = [];
    for (const group of ALL_GROUPS) {
      const inGroup = inTier.filter((t) => t.group === group);
      if (!inGroup.length) continue;
      if (lines.length) lines.push('');
      lines.push(`  /* ${GROUP_LABEL[group]} */`);
      lines.push(...inGroup.map((t) => decl(t, unit)));
    }
    let css = `/* ===== ${TIER_TITLES[tier]} ===== */\n:root {\n${lines.join('\n')}\n}\n`;

    // Wide-gamut colors for P3 displays
    const p3 = inTier.filter((t) => t.p3);
    if (p3.length) {
      css += `\n@supports (color: color(display-p3 1 1 1)) {\n  @media (color-gamut: p3) {\n    :root {\n`;
      css += p3.map((t) => `      --${t.name}: ${t.p3};`).join('\n');
      css += '\n    }\n  }\n}\n';
    }

    // Put data-theme="dark" on <html> so tokens that alias these resolve against the dark values
    const dark = inTier.filter((t) => t.darkRef);
    if (dark.length) css += `\n${DARK_SELECTOR} {\n${dark.map((t) => `  --${t.name}: var(--${t.darkRef});`).join('\n')}\n}\n`;

    // Put data-product on <html> to switch the roles an extra product fills itself
    css += productCss(inTier.flatMap((t) => t.products?.map((o) => ({ name: t.name, ...o })) ?? []));

    const widths = [...new Set(inTier.flatMap((t) => t.responsive?.map((r) => r.minWidth) ?? []))].sort((a, b) => a - b);
    for (const w of widths) {
      const entries = inTier.flatMap((t) => t.responsive?.filter((r) => r.minWidth === w).map((r) => ({ t, r })) ?? []);
      const label = [...new Set(entries.map((e) => e.r.label))].join(', ');
      css += `\n@media (min-width: ${w}px) { /* ${label} */\n  :root {\n`;
      css += entries.map(({ t, r }) => `    --${t.name}: var(--${r.ref});`).join('\n');
      css += '\n  }\n}\n';
    }
    out.push(css);
  }
  return out.join('\n');
}

/** One block per extra product, plus its dark values when there are any. */
function productCss(overrides: { name: string; product: string; ref: string; darkRef?: string }[]) {
  let css = '';
  for (const product of [...new Set(overrides.map((o) => o.product))]) {
    const own = overrides.filter((o) => o.product === product);
    const selector = `[data-product="${productSlug(product)}"]`;
    css += `\n/* ${product} */\n${selector} {\n${own.map((o) => `  --${o.name}: var(--${o.ref});`).join('\n')}\n}\n`;
    const dark = own.filter((o) => o.darkRef);
    if (dark.length) css += `\n${DARK_SELECTOR}${selector} {\n${dark.map((o) => `  --${o.name}: var(--${o.darkRef});`).join('\n')}\n}\n`;
  }
  return css;
}

/** Ready-made classes built only from semantic tokens. */
function utilitiesCss(tokens: Token[]) {
  const names = new Set(tokens.map((t) => t.name));
  let css = '';
  const styles = tokens.filter((t) => t.type === 'typography');
  if (styles.length) {
    css += '/* ===== Text styles ===== */\n';
    for (const s of styles) {
      const p = s.value as TypographyParts;
      css += `.${s.name} {\n  font-family: var(--${p.family});\n  font-size: var(--${p.size});\n  line-height: var(--${p.lineHeight});\n  font-weight: var(--${p.weight});\n  letter-spacing: var(--${p.tracking});\n}\n`;
    }
  }
  if (names.has('page-columns')) {
    css += `${css ? '\n' : ''}/* ===== Layout ===== */\n`;
    css += `.container {\n  width: 100%;\n  max-width: ${names.has('page-max-width') ? 'calc(var(--page-max-width) + 2 * var(--page-margin))' : 'none'};\n  margin-inline: auto;\n  padding-inline: var(--page-margin);\n}\n`;
    css += '.grid {\n  display: grid;\n  grid-template-columns: repeat(var(--page-columns), minmax(0, 1fr));\n  column-gap: var(--page-gutter);\n}\n';
  }
  return css;
}

interface ExportOptions {
  scope: ExportScope;
  unit: LengthUnit;
  colorFormat: ColorFormat;
}

export function generateCss(palettes: GeneratedPalette[], f: Foundations, opts: ExportOptions) {
  const tokens = buildTokens(palettes, f, { groups: groupsFor(opts.scope), modes: 'both', colorFormat: opts.colorFormat });
  const utilities = utilitiesCss(tokens);
  return `${variablesCss(tokens, opts.unit)}${utilities ? `\n${utilities}` : ''}`;
}

// ============================================================
// JSON (W3C design tokens)
// ============================================================

const DTCG_TYPE: Record<Token['type'], string> = {
  color: 'color',
  dimension: 'dimension',
  number: 'number',
  fontFamily: 'fontFamily',
  fontWeight: 'fontWeight',
  letterSpacing: 'dimension',
  shadow: 'shadow',
  typography: 'typography',
};

function setPath(obj: Record<string, unknown>, path: string[], value: unknown) {
  let node = obj;
  for (const key of path.slice(0, -1)) node = (node[key] ??= {}) as Record<string, unknown>;
  node[path.at(-1)!] = value;
}

/** `{tier.path}` reference to another token, as the W3C format writes aliases. */
function aliasResolver(tokens: Token[]) {
  const byName = new Map(tokens.map((t) => [t.name, t]));
  return (name: string) => {
    const t = byName.get(name);
    return t ? `{${[t.tier, ...t.path].join('.')}}` : `{${name}}`;
  };
}

const DTCG_TYPOGRAPHY: Record<keyof TypographyParts, string> = {
  family: 'fontFamily',
  size: 'fontSize',
  lineHeight: 'lineHeight',
  weight: 'fontWeight',
  tracking: 'letterSpacing',
};

/** A text style as one W3C typography token, each property aliasing what its own token points at. */
function typographyValue(t: Token, byName: Map<string, Token>, alias: (name: string) => string) {
  const parts = t.value as TypographyParts;
  return Object.fromEntries(
    (Object.keys(DTCG_TYPOGRAPHY) as (keyof TypographyParts)[]).flatMap((k) => {
      const to = byName.get(parts[k])?.ref;
      return to ? [[DTCG_TYPOGRAPHY[k], alias(to)]] : [];
    }),
  );
}

function jsonValue(t: Token, unit: LengthUnit, alias: (name: string) => string) {
  if (t.type === 'shadow') {
    return (t.value as ShadowLayer[]).map((l) => ({
      offsetX: `${l.x}px`,
      offsetY: `${l.y}px`,
      blur: `${l.blur}px`,
      spread: `${l.spread}px`,
      color: l.colorRef ? alias(l.colorRef) : l.color,
    }));
  }
  if (t.type === 'number' || t.type === 'fontWeight') return t.value;
  return cssValue(t, unit);
}

export function generateJson(palettes: GeneratedPalette[], f: Foundations, opts: ExportOptions) {
  const tokens = buildTokens(palettes, f, { groups: groupsFor(opts.scope), modes: 'both', colorFormat: opts.colorFormat });
  const alias = aliasResolver(tokens);
  const byName = new Map(tokens.map((t) => [t.name, t]));
  const out: Record<string, unknown> = {};
  for (const t of tokens) {
    // A text style holds its properties, so they don't also go out on their own
    if (t.partOf) continue;
    if (t.type === 'typography') {
      // Each product with its own fonts swaps the family
      const products = byName.get((t.value as TypographyParts).family)?.products;
      setPath(out, [t.tier, ...t.path], {
        $type: 'typography',
        $value: typographyValue(t, byName, alias),
        ...(t.description && { $description: t.description }),
        ...(products && {
          $extensions: {
            'lumina.products': Object.fromEntries(products.map((o) => [o.product, { $value: { fontFamily: alias(o.ref) } }])),
          },
        }),
      });
      continue;
    }
    const extensions: Record<string, unknown> = {};
    if (t.darkRef) extensions.modes = { dark: alias(t.darkRef) };
    if (t.products) {
      extensions['lumina.products'] = Object.fromEntries(
        t.products.map((o) => [o.product, { $value: alias(o.ref), ...(o.darkRef && { dark: alias(o.darkRef) }) }]),
      );
    }
    if (t.responsive) {
      extensions['lumina.responsive'] = [
        ...(t.baseLabel ? [{ label: t.baseLabel, minWidth: 0, value: alias(t.ref!) }] : []),
        ...t.responsive.map((r) => ({ label: r.label, minWidth: r.minWidth, value: alias(r.ref) })),
      ];
    }
    setPath(out, [t.tier, ...t.path], {
      $type: DTCG_TYPE[t.type],
      $value: t.ref ? alias(t.ref) : jsonValue(t, opts.unit, alias),
      ...(t.description && { $description: t.description }),
      ...(Object.keys(extensions).length && { $extensions: extensions }),
    });
  }
  return JSON.stringify(out, null, 2);
}

// ============================================================
// Color collections
// ============================================================

/** Color splits into three collections, one per tier, each exported on its own. */
export type ColorCollection = Token['tier'];

export const COLOR_COLLECTIONS: Record<ColorCollection, string> = {
  primitive: 'Color Palette',
  base: 'Color',
  semantic: 'Theme',
};

/** `Color Palette` → `color-palette`, for filenames and JSON roots. */
const collectionSlug = (tier: ColorCollection) => COLOR_COLLECTIONS[tier].toLowerCase().replace(/\s+/g, '-');

export const colorCollectionFilename = (tier: ColorCollection, ext: 'css' | 'json' | 'csv') =>
  ext === 'csv' ? `${COLOR_COLLECTIONS[tier]}.csv` : `${collectionSlug(tier)}.${ext}`;

/**
 * Where each variable can be applied in Figma. Primitives and base tokens get none, so they stay
 * out of the pickers and designers only apply semantic tokens, each where its usage says.
 */
function figmaScopes(t: Token): string[] {
  if (t.tier !== 'semantic' || t.group !== 'color') return [];
  if (t.name.startsWith('bg')) return ['FRAME_FILL', 'SHAPE_FILL'];
  // Text and icons, which are vector shapes
  if (t.name.startsWith('fg')) return ['TEXT_FILL', 'SHAPE_FILL'];
  if (t.name.startsWith('border')) return ['STROKE'];
  // Focus rings are drawn as strokes or spread shadows
  if (t.name.startsWith('focus')) return ['STROKE', 'EFFECT_COLOR'];
  return ['ALL_FILLS', 'STROKE'];
}

/** `brand/9` → `brand-dark/9`, matching how dark primitives are named (`gray-dark/9`). */
const darkPath = (path: string[]) => [`${path[0]}-dark`, ...path.slice(1)];

interface ColorValue {
  /** The primitive the value resolves to, for raw colors. */
  primitive: Token;
  /** The variable it aliases in the collection below, if any. */
  alias?: { tier: ColorCollection; path: string[] };
}

interface ColorVariable {
  token: Token;
  path: string[];
  /** Theme has a Light and a Dark value; Palette has one, under Default; Color has one per product, or Default. */
  modes: Record<string, ColorValue>;
}

/**
 * The variables of one color collection. Palette and Color hold light and `-dark` variables side by
 * side in a single mode; Theme aliases the light Color variables in Light and the `-dark` ones in Dark.
 */
function colorCollectionVariables(palettes: GeneratedPalette[], f: Foundations, tier: ColorCollection, colorFormat: ColorFormat = 'hex'): ColorVariable[] {
  const tokens = buildTokens(palettes, f, { groups: ['color'], modes: 'both', colorFormat });
  const byName = new Map(tokens.map((t) => [t.name, t]));
  // Variable paths inside each collection, without the tier and `color` roots the collection already names
  const lightPaths = new Map(tokens.map((t) => [t.name, t.path.slice(1)]));
  const darkPaths = new Map(tokens.filter((t) => t.tier === 'base' && t.darkRef).map((t) => [t.name, darkPath(t.path.slice(1))]));
  // Color gets a mode per product once there's more than one
  const products = productsOf(f);
  const productModes = products.length > 1 ? products.map((p) => p.name) : ['Default'];

  const out: ColorVariable[] = [];
  // Color lists each role's light group, then its -dark group, like the palettes below it
  let darkGroup: ColorVariable[] = [];
  const flushDark = () => {
    out.push(...darkGroup);
    darkGroup = [];
  };
  for (const t of tokens) {
    if (t.tier !== tier) continue;
    const path = lightPaths.get(t.name)!;
    if (tier === 'base' && darkGroup.length && darkGroup[0].token.path[1] !== t.path[1]) flushDark();
    if (tier === 'primitive') {
      out.push({ token: t, path, modes: { Default: { primitive: t } } });
    } else if (tier === 'base') {
      const to = (ref: string): ColorValue => ({ primitive: byName.get(ref)!, alias: { tier: 'primitive', path: lightPaths.get(ref)! } });
      /** Each product's alias, or the first product's when it doesn't refill this role. */
      const modes = (isDark: boolean) =>
        Object.fromEntries(
          productModes.map((m, i) => {
            const own = i === 0 ? undefined : t.products?.find((o) => o.product === m);
            return [m, to(isDark ? (own?.darkRef ?? t.darkRef!) : (own?.ref ?? t.ref!))];
          }),
        );
      out.push({ token: t, path, modes: modes(false) });
      if (t.darkRef) darkGroup.push({ token: t, path: darkPath(path), modes: modes(true) });
    } else {
      const to = (isDark: boolean): ColorValue => ({
        primitive: resolveToken(t, byName, isDark)!,
        alias: { tier: 'base', path: (isDark && darkPaths.get(t.ref!)) || lightPaths.get(t.ref!)! },
      });
      out.push({ token: t, path, modes: { Light: to(false), Dark: to(true) } });
    }
  }
  flushDark();
  return out;
}

const COLLECTION_TITLES: Record<ColorCollection, string> = {
  primitive: 'Color Palette — raw steps, light and -dark side by side. Reference these only from Color.',
  base: 'Color — roles aliasing Color Palette, light and -dark side by side. Load color-palette.css first.',
  semantic: 'Theme — purposes aliasing Color, with dark values under [data-theme="dark"]. Use these in components. Load color.css first.',
};

/** One color collection as custom properties. Variable names are the collection paths joined with `-`. */
export function generateColorCollectionCss(palettes: GeneratedPalette[], f: Foundations, tier: ColorCollection, colorFormat: ColorFormat) {
  const variables = colorCollectionVariables(palettes, f, tier, colorFormat);
  const value = ({ primitive, alias }: ColorValue) => (alias ? `var(--${alias.path.join('-')})` : String(primitive.value));
  const [firstMode, ...otherModes] = Object.keys(variables[0]?.modes ?? { Default: null });
  let css = `/* ===== ${COLLECTION_TITLES[tier]} ===== */\n:root {\n`;
  css += variables.map((v) => `  --${v.path.join('-')}: ${value(v.modes[firstMode])};`).join('\n');
  css += '\n}\n';

  // Wide-gamut colors for P3 displays
  const p3 = variables.filter((v) => !v.modes[firstMode].alias && v.token.p3);
  if (p3.length) {
    css += `\n@supports (color: color(display-p3 1 1 1)) {\n  @media (color-gamut: p3) {\n    :root {\n`;
    css += p3.map((v) => `      --${v.path.join('-')}: ${v.token.p3};`).join('\n');
    css += '\n    }\n  }\n}\n';
  }

  // Put data-product on <html> to switch Color to another product's palettes
  if (tier === 'base') {
    for (const mode of otherModes) {
      const own = variables.filter((v) => value(v.modes[mode]) !== value(v.modes[firstMode]));
      if (!own.length) continue;
      css += `\n/* ${mode} */\n[data-product="${productSlug(mode)}"] {\n${own.map((v) => `  --${v.path.join('-')}: ${value(v.modes[mode])};`).join('\n')}\n}\n`;
    }
  }

  // Put data-theme="dark" on <html> to switch Theme to the dark Color variables
  if (tier === 'semantic') {
    css += `\n${DARK_SELECTOR} {\n${variables.map((v) => `  --${v.path.join('-')}: ${value(v.modes.Dark)};`).join('\n')}\n}\n`;
  }
  return css;
}

/**
 * One color collection as W3C design tokens, rooted at the collection (`color-palette`, `color`,
 * `theme`) so aliases into another collection's file (`{color-palette.indigo.9}`) resolve once the
 * files are merged. Theme keeps its dark alias in `$extensions`, like the full JSON export.
 */
export function generateColorCollectionJson(palettes: GeneratedPalette[], f: Foundations, tier: ColorCollection, colorFormat: ColorFormat) {
  const variables = colorCollectionVariables(palettes, f, tier, colorFormat);
  const ref = (v: ColorValue) => (v.alias ? `{${[collectionSlug(v.alias.tier), ...v.alias.path].join('.')}}` : String(v.primitive.value));
  const out: Record<string, unknown> = {};
  for (const { token: t, path, modes } of variables) {
    const [first, ...others] = Object.keys(modes);
    // Theme's dark alias, and each product's alias in Color where it differs from the first product's
    const extra = Object.fromEntries(
      others.map((m) => [m === 'Dark' ? 'dark' : m, ref(modes[m])]).filter(([m, v]) => m === 'dark' || v !== ref(modes[first])),
    );
    setPath(out, [collectionSlug(tier), ...path], {
      $type: 'color',
      $value: ref(modes[first]),
      ...(t.description && { $description: t.description }),
      ...(Object.keys(extra).length && { $extensions: { modes: extra } }),
    });
  }
  return JSON.stringify(out, null, 2);
}

// ============================================================
// Color collections for the Sheet Variable Importer plugin
// ============================================================

/** The plugin's scope labels, as Figma's variable picker names them. */
const SCOPE_LABELS: Record<string, string> = {
  ALL_FILLS: 'Fill',
  FRAME_FILL: 'Frame',
  SHAPE_FILL: 'Shape',
  TEXT_FILL: 'Text',
  STROKE: 'Stroke',
  EFFECT_COLOR: 'Effects',
};

const csvCell = (field: string) => (/[",\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field);

/**
 * One collection as a Sheet Variable Importer CSV. The plugin links aliases into other collections
 * (`{Color Palette:indigo/9}`), so import Color Palette, then Color, then Theme. Theme carries Light and Dark in one file. Color Palette adds an `_OKLCH` column for
 * reference in Sheets, which the plugin skips like any header starting with `_`.
 */
export function generateColorCollectionCsv(palettes: GeneratedPalette[], f: Foundations, tier: ColorCollection) {
  const variables = colorCollectionVariables(palettes, f, tier);
  const modeNames = Object.keys(variables[0]?.modes ?? { Default: null });
  const collection = COLOR_COLLECTIONS[tier];
  const oklch = tier === 'primitive';
  const lines = [['Collection Name', 'Name', 'Type', 'Description', 'Scope', ...modeNames.map((m) => `Mode: ${m}`), ...(oklch ? ['_OKLCH'] : [])].join(',')];
  for (const { token: t, path, modes } of variables) {
    const scopes = figmaScopes(t).map((s) => SCOPE_LABELS[s] ?? s);
    const cells = modeNames.map((m) => {
      const { primitive, alias } = modes[m];
      return alias ? `{${COLOR_COLLECTIONS[alias.tier]}:${alias.path.join('/')}}` : chroma(primitive.value as string).hex();
    });
    lines.push([collection, path.join('/'), 'COLOR', t.description ?? '', scopes.length ? scopes.join(', ') : 'No scope', ...cells, ...(oklch ? [t.p3 ?? ''] : [])].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

// ============================================================
// Other foundations for the Sheet Variable Importer plugin
// ============================================================

/** Foundations exported as variables. Shadow has no variable type in Figma, so it goes out as layer colors and effect styles. */
export type SheetGroup = Exclude<TokenGroup, 'color' | 'shadow'>;

/** Like Color, each foundation splits into three collections, one per tier: raw scale, roles, purposes. */
export const SHEET_COLLECTIONS: Record<SheetGroup, Record<Token['tier'], string>> = {
  typography: { primitive: 'Type Scale', base: 'Typography', semantic: 'Text' },
  spacing: { primitive: 'Space Scale', base: 'Spacing', semantic: 'Layout Spacing' },
  radius: { primitive: 'Radius Scale', base: 'Radius', semantic: 'Shape' },
  grid: { primitive: 'Breakpoints', base: 'Grid', semantic: 'Page Layout' },
};

/** What a foundation's Sheets export holds: its variables, or the styles built on them. */
export type SheetKind = 'variables' | 'text-styles' | 'effect-styles';

export const SHEET_FILENAMES: Record<Exclude<SheetKind, 'variables'>, string> = {
  'text-styles': 'Text Styles.csv',
  'effect-styles': 'Shadow Styles.csv',
};

export const sheetFilename = (group: SheetGroup, tier: Token['tier']) => `${SHEET_COLLECTIONS[group][tier]}.csv`;

/** Variable paths inside a collection, without the root every token there shares (`font/size/md` → `size/md`). */
function collectionPaths(tokens: Token[]) {
  const roots = new Set(tokens.map((t) => t.path[0]));
  const strip = roots.size === 1 && tokens.every((t) => t.path.length > 1);
  return new Map(tokens.map((t) => [t.name, (strip ? t.path.slice(1) : t.path).join('/')]));
}

/** Only semantic tokens get a scope, so designers pick them in Figma, like Theme colors. */
function sheetScopes(t: Token): string[] {
  if (t.tier !== 'semantic') return [];
  switch (t.group) {
    case 'spacing':
      return ['Gap'];
    case 'radius':
      return ['Corner radius'];
    case 'typography': {
      const prop = t.path[t.path.length - 1];
      return ({ family: ['Font family'], size: ['Font size'], 'line-height': ['Line height'], weight: ['Font weight'] } as Record<string, string[]>)[prop] ?? [];
    }
    case 'grid':
      return t.type === 'number' ? [] : t.name === 'page-gutter' || t.name === 'page-margin' ? ['Gap'] : ['Width and height'];
    default:
      return [];
  }
}

/** `xs` → `XS`, `mobile` → `Mobile`. */
const modeLabel = (label: string) => (label.length <= 3 ? label.toUpperCase() : label[0].toUpperCase() + label.slice(1));

/** The first family in a stack, the name Figma knows the font by. */
const firstFamily = (stack: string) => stack.split(',')[0].trim().replace(/^"|"$/g, '') || stack;

/** Raw value as the plugin reads it. Letter spacing is in em, which Figma variables can't hold, so it's a percent. */
function sheetValue(t: Token): string {
  switch (t.type) {
    case 'fontFamily':
      return firstFamily(String(t.value));
    case 'letterSpacing':
      return trim((t.value as number) * 100, 2);
    default:
      return String(t.value);
  }
}

const SHEET_TYPES: Partial<Record<Token['type'], string>> = { fontFamily: 'STRING' };

/**
 * One tier of a foundation as its own collection. Aliases point into the collection below
 * (`{Space Scale:4}`), so import the scale, then the roles, then the purposes. Modes only appear where
 * values change: responsive roles get a mode per breakpoint, and Text a mode per product when one has its own fonts.
 */
export function generateSheetVariablesCsv(palettes: GeneratedPalette[], f: Foundations, group: SheetGroup, tier: Token['tier']) {
  // Figma has no variable type for a text style; Text Styles.csv builds those from these variables
  const all = buildTokens(palettes, f, { groups: [group], modes: 'light', colorFormat: 'hex' }).filter((t) => t.type !== 'typography');
  const byName = new Map(all.map((t) => [t.name, t]));
  const paths = new Map(TIERS.flatMap((tr) => [...collectionPaths(all.filter((t) => t.tier === tr))]));
  const tokens = all.filter((t) => t.tier === tier);
  const ownPath = (t: Token) => paths.get(t.name)!;

  // Breakpoints, smallest first, from the tokens that switch at them
  const breakpoints = new Map<string, number>();
  for (const t of tokens) {
    if (!t.responsive) continue;
    if (t.baseLabel) breakpoints.set(t.baseLabel, 0);
    for (const r of t.responsive) breakpoints.set(r.label, r.minWidth);
  }
  const bpList = [...breakpoints].sort((a, b) => a[1] - b[1]);
  const products = productsOf(f).map((p) => p.name);
  const productList = tokens.some((t) => t.products?.length) ? products : [products[0]];

  const modes = productList.flatMap((product, pi) =>
    (bpList.length ? bpList : [[null, 0] as const]).map(([bp, minWidth]) => ({
      name: [productList.length > 1 ? product : '', bp ? modeLabel(bp) : ''].filter(Boolean).join(' ') || 'Default',
      product: pi === 0 ? undefined : product,
      minWidth,
    })),
  );

  /** The alias that applies in a mode: the product's own, else the widest breakpoint at or below it, else the default. */
  const refIn = (t: Token, mode: (typeof modes)[number]) =>
    (mode.product && t.products?.find((o) => o.product === mode.product)?.ref) ??
    [...(t.responsive ?? [])].reverse().find((r) => r.minWidth <= mode.minWidth && bpList.length)?.ref ??
    t.ref;

  const collection = SHEET_COLLECTIONS[group][tier];
  const lines = [['Collection Name', 'Name', 'Type', 'Description', 'Scope', ...modes.map((m) => `Mode: ${m.name}`)].join(',')];
  for (const t of tokens) {
    const cells = modes.map((m) => {
      const ref = refIn(t, m);
      const target = ref ? byName.get(ref) : undefined;
      return target ? `{${SHEET_COLLECTIONS[group][target.tier]}:${ownPath(target)}}` : sheetValue(t);
    });
    const description = t.type === 'letterSpacing' ? [t.description, 'Percent of font size'].filter(Boolean).join('. ') : (t.description ?? '');
    const scopes = sheetScopes(t);
    lines.push([collection, ownPath(t), SHEET_TYPES[t.type] ?? 'FLOAT', description, scopes.length ? scopes.join(', ') : 'No scope', ...cells].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

const FONT_STYLE_NAMES: Record<number, string> = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold' };

/**
 * One text style per text style token, bound to the Text collection, so sizes follow Typography's
 * Mobile and Desktop modes. Letter spacing is a raw percent, since Figma reads bound letter spacing as px.
 * Every style is named by token path, as shadows are: text-h1 → text/h1, the user's text-button → text/button.
 */
export function generateTextStylesCsv(palettes: GeneratedPalette[], f: Foundations) {
  const tokens = buildTokens(palettes, f, { groups: ['typography'], modes: 'light', colorFormat: 'hex' });
  const byName = new Map(tokens.map((t) => [t.name, t]));
  const collection = SHEET_COLLECTIONS.typography.semantic;
  const paths = collectionPaths(tokens.filter((t) => t.tier === 'semantic' && t.type !== 'typography'));
  const alias = (t: Token) => `{${collection}:${paths.get(t.name)}}`;

  const lines = [['Name', 'Type', 'Description', 'Property', 'Value'].join(',')];
  for (const style of tokens.filter((t) => t.type === 'typography')) {
    const parts = style.value as TypographyParts;
    const prop = (k: keyof TypographyParts) => byName.get(parts[k]);
    const name = style.path.join('/');
    const description = style.description ?? '';
    const rows: [string, string][] = [];
    const family = prop('family');
    if (family) rows.push(['Font Family', alias(family)]);
    const weight = prop('weight');
    if (weight) {
      const value = resolveToken(weight, byName)?.value as number | undefined;
      // The style keeps its weight in Font Style; the bound weight variable takes over when it resolves
      if (value !== undefined) rows.push(['Font Style', FONT_STYLE_NAMES[value] ?? 'Regular']);
      rows.push(['Font Weight', alias(weight)]);
    }
    const size = prop('size');
    if (size) rows.push(['Font Size', alias(size)]);
    const lineHeight = prop('lineHeight');
    if (lineHeight) rows.push(['Line Height', alias(lineHeight)]);
    const tracking = prop('tracking');
    const em = tracking ? resolveToken(tracking, byName)?.value : undefined;
    if (typeof em === 'number') rows.push(['Letter Spacing', `${trim(em * 100, 2)}%`]);
    for (const [property, value] of rows) lines.push([name, 'TYPOGRAPHY', description, property, value].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

// ============================================================
// Shadow for the Sheet Variable Importer plugin
// ============================================================

/** Effect styles have no modes, so each layer's color is a variable with Light and Dark modes instead. */
export const SHADOW_COLLECTION = 'Shadow';

/** `rgb(r g b / a)` → `rgba(r, g, b, a)`. The plugin splits on spaces and commas, so the slash form won't parse. */
function rgbaColor(css: string) {
  const m = css.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)/);
  const [r, g, b, a] = m
    ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])]
    : chroma(css).rgba();
  return `rgba(${r}, ${g}, ${b}, ${trim(a, 3)})`;
}

interface ShadowMode {
  /** Mode name: Light and Dark, prefixed with the product once a product has its own tint (`Pro Dark`). */
  name: string;
  isDark: boolean;
  /** The product, when it isn't the first. */
  product?: string;
  /** Whether this product's colors differ from the first product's, so CSS needs a block for it. */
  own: boolean;
}

/** The shadow tokens in both modes, with the color slots, styles and modes the exports need. */
function shadowModel(palettes: GeneratedPalette[], f: Foundations) {
  const tokens = buildTokens(palettes, f, { groups: ['shadow'], modes: 'both', colorFormat: 'hex' });
  const byName = new Map(tokens.map((t) => [t.name, t]));
  const slots = tokens.filter((t) => t.tier === 'base' && t.type === 'color');
  const tinted = new Set(slots.flatMap((t) => t.products?.map((o) => o.product) ?? []));
  const products = productsOf(f).map((p) => p.name);
  const modes: ShadowMode[] = (tinted.size ? products : [products[0]]).flatMap((product, i) =>
    (['Light', 'Dark'] as const).map((label) => ({
      name: tinted.size ? `${product} ${label}` : label,
      isDark: label === 'Dark',
      product: i ? product : undefined,
      own: tinted.has(product),
    })),
  );
  return { byName, slots, modes, styles: shadowStyles(tokens, byName) };
}

/**
 * The effect styles, named by token path like text styles, so Figma reads as the JSON export does:
 * levels (shadow/md), then purposes (shadow-toast → shadow/toast, container-toast → shadow/container-toast).
 * Each takes the level it resolves to, so a re-pointed or added token gets that level's layers.
 */
function shadowStyles(tokens: Token[], byName: Map<string, Token>) {
  return tokens.flatMap((t) => {
    if (t.tier === 'primitive' || t.type !== 'shadow') return [];
    const level = resolveToken(t, byName);
    if (!level?.value) return [];
    return [{ name: t.path.join('/'), token: t.name, description: t.description ?? '', level }];
  });
}

/** A color slot's value in a mode, as `rgba()`. */
function slotColor(slot: Token, byName: Map<string, Token>, mode: ShadowMode) {
  const probe: Token = { ...slot, type: 'shadow', value: [{ x: 0, y: 0, blur: 0, spread: 0, color: '', colorRef: slot.name }] };
  return rgbaColor(resolveShadowLayers(probe, byName, mode.isDark, mode.product)[0].color);
}

/** Figma's variable path for a color slot: `shadow/layer-1/color`. */
const slotPath = (slot: Token) => slot.path.join('/');

/**
 * The Shadow collection: the base color slots, Light and Dark, scoped to effects. Once a product has
 * its own tint, every product gets its own Light and Dark. Import it before the styles.
 */
export function generateShadowVariablesCsv(palettes: GeneratedPalette[], f: Foundations) {
  const { byName, slots, modes } = shadowModel(palettes, f);
  const lines = [['Collection Name', 'Name', 'Type', 'Description', 'Scope', ...modes.map((m) => `Mode: ${m.name}`)].join(',')];
  for (const slot of slots) {
    const cells = modes.map((m) => slotColor(slot, byName, m));
    lines.push([SHADOW_COLLECTION, slotPath(slot), 'COLOR', slot.description ?? '', SCOPE_LABELS.EFFECT_COLOR, ...cells].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * One effect style per level (`shadow/md`) and per custom purpose (`shadow/toast`), one row per layer.
 * Each layer's color is bound to the Shadow collection, so a single set follows its Light and Dark modes.
 */
export function generateEffectStylesCsv(palettes: GeneratedPalette[], f: Foundations) {
  const { byName, styles } = shadowModel(palettes, f);
  const lines = [['Name', 'Type', 'Description', 'Shadow Type', 'Color', 'Offset X', 'Offset Y', 'Radius', 'Spread'].join(',')];
  for (const { name, description, level } of styles) {
    for (const l of level.value as ShadowLayer[]) {
      const slot = l.colorRef ? byName.get(l.colorRef) : undefined;
      const color = slot ? `{${SHADOW_COLLECTION}:${slotPath(slot)}}` : rgbaColor(l.color);
      lines.push([name, 'EFFECT', description, 'Drop Shadow', color, String(l.x), String(l.y), String(l.blur), String(l.spread)].map(csvCell).join(','));
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The shadow styles resolved per mode, one custom property each (`shadow/md` → `--shadow-md`). Light
 * is the default and also applies under `[data-theme="light"]`, so a light section can sit inside a
 * dark page; dark applies under `[data-theme="dark"]`. Every style has the same layers in both modes.
 */
export function generateShadowStylesCss(palettes: GeneratedPalette[], f: Foundations) {
  const { byName, modes, styles } = shadowModel(palettes, f);
  // Extra products that keep the shared tint need no block of their own
  return modes
    .filter((m) => !m.product || m.own)
    .map((mode) => {
      // Properties keep the token's name, as in the full CSS export; the comment names the Figma style
      const props = styles.map(({ name, token, description, level }) => {
        const value = resolveShadowLayers(level, byName, mode.isDark, mode.product).map((l) => layerToCss({ ...l, color: rgbaColor(l.color) })).join(', ');
        return `${description ? `  /* ${description} */\n` : ''}  /* ${name} */\n  --${token}: ${value};`;
      });
      const productSelector = mode.product ? `[data-product="${productSlug(mode.product)}"]` : '';
      const selector = mode.isDark ? `${DARK_SELECTOR}${productSelector}` : productSelector || ':root, [data-theme="light"]';
      return `/* Mode: ${mode.name} */\n${selector} {\n${props.join('\n')}\n}\n`;
    })
    .join('\n');
}

/** The shadow styles resolved per mode, grouped by mode then style path, with colors as 8-digit hex. */
export const generateShadowStylesJson = (palettes: GeneratedPalette[], f: Foundations) => JSON.stringify(shadowStylesByMode(palettes, f), null, 2);

function shadowStylesByMode(palettes: GeneratedPalette[], f: Foundations) {
  const { byName, modes, styles } = shadowModel(palettes, f);
  const out: Record<string, unknown> = {};
  for (const mode of modes) {
    for (const { name, description, level } of styles) {
      setPath(out, [mode.name, ...name.split('/')], {
        type: 'shadow',
        value: resolveShadowLayers(level, byName, mode.isDark, mode.product).map((l) => ({
          inset: false,
          color: chroma(rgbaColor(l.color)).hex('rgba'),
          offsetX: `${l.x}px`,
          offsetY: `${l.y}px`,
          blur: `${l.blur}px`,
          spread: `${l.spread}px`,
        })),
        description,
      });
    }
  }
  return out;
}
