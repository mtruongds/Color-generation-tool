import chroma from 'chroma-js';
import type { ColorFormat } from './color-utils';
import type { GeneratedPalette } from './export-utils';
import { type Foundations, type ShadowLayer, layerToCss } from './foundations';
import { TIERS, type Token, type TokenGroup, buildTokens, resolveToken } from './tokens';

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
  base: 'Base — roles. Each aliases a primitive; dark mode swaps them under .dark.',
  semantic: 'Semantic — purposes. Use these in components.',
};

/** Raw primitive value as CSS. Shadows and letter spacing ignore the unit. */
function cssValue(t: Token, unit: LengthUnit): string {
  switch (t.type) {
    case 'dimension':
      // 9999px stays px so pills stay round whatever the unit
      return (t.value as number) >= 9999 ? '9999px' : formatLength(t.value as number, unit);
    case 'letterSpacing':
      return t.value === 0 ? '0' : `${t.value}em`;
    case 'shadow':
      return (t.value as ShadowLayer[]).map(layerToCss).join(', ');
    default:
      return String(t.value);
  }
}

const decl = (t: Token, unit: LengthUnit, indent = '  ') =>
  `${indent}--${t.name}: ${t.ref ? `var(--${t.ref})` : cssValue(t, unit)};`;

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

    // Put .dark on <html> so tokens that alias these resolve against the dark values
    const dark = inTier.filter((t) => t.darkRef);
    if (dark.length) css += `\n.dark {\n${dark.map((t) => `  --${t.name}: var(--${t.darkRef});`).join('\n')}\n}\n`;

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

/** Ready-made classes built only from semantic tokens. */
function utilitiesCss(tokens: Token[]) {
  const names = new Set(tokens.map((t) => t.name));
  let css = '';
  const styles = [...new Set(tokens.filter((t) => t.group === 'typography' && t.tier === 'semantic').map((t) => t.path[1]))];
  if (styles.length) {
    css += '/* ===== Text styles ===== */\n';
    for (const s of styles) {
      css += `.text-${s} {\n  font-family: var(--text-${s}-family);\n  font-size: var(--text-${s}-size);\n  line-height: var(--text-${s}-line-height);\n  font-weight: var(--text-${s}-weight);\n  letter-spacing: var(--text-${s}-tracking);\n}\n`;
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

function jsonValue(t: Token, unit: LengthUnit) {
  if (t.type === 'shadow') {
    return (t.value as ShadowLayer[]).map((l) => ({
      offsetX: `${l.x}px`,
      offsetY: `${l.y}px`,
      blur: `${l.blur}px`,
      spread: `${l.spread}px`,
      color: l.color,
    }));
  }
  if (t.type === 'number' || t.type === 'fontWeight') return t.value;
  return cssValue(t, unit);
}

export function generateJson(palettes: GeneratedPalette[], f: Foundations, opts: ExportOptions) {
  const tokens = buildTokens(palettes, f, { groups: groupsFor(opts.scope), modes: 'both', colorFormat: opts.colorFormat });
  const alias = aliasResolver(tokens);
  const out: Record<string, unknown> = {};
  for (const t of tokens) {
    const extensions: Record<string, unknown> = {};
    if (t.darkRef) extensions.modes = { dark: alias(t.darkRef) };
    if (t.responsive) {
      extensions['lumina.responsive'] = [
        ...(t.baseLabel ? [{ label: t.baseLabel, minWidth: 0, value: alias(t.ref!) }] : []),
        ...t.responsive.map((r) => ({ label: r.label, minWidth: r.minWidth, value: alias(r.ref) })),
      ];
    }
    setPath(out, [t.tier, ...t.path], {
      $type: DTCG_TYPE[t.type],
      $value: t.ref ? alias(t.ref) : jsonValue(t, opts.unit),
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
  /** Theme has a Light and a Dark value; Palette and Color have one, under Default. */
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
      out.push({ token: t, path, modes: { Default: to(t.ref!) } });
      if (t.darkRef) darkGroup.push({ token: t, path: darkPath(path), modes: { Default: to(t.darkRef) } });
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
  semantic: 'Theme — purposes aliasing Color, with dark values under .dark. Use these in components. Load color.css first.',
};

/** One color collection as custom properties. Variable names are the collection paths joined with `-`. */
export function generateColorCollectionCss(palettes: GeneratedPalette[], f: Foundations, tier: ColorCollection, colorFormat: ColorFormat) {
  const variables = colorCollectionVariables(palettes, f, tier, colorFormat);
  const value = ({ primitive, alias }: ColorValue) => (alias ? `var(--${alias.path.join('-')})` : String(primitive.value));
  const firstMode = tier === 'semantic' ? 'Light' : 'Default';
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

  // Put .dark on <html> to switch Theme to the dark Color variables
  if (tier === 'semantic') {
    css += `\n.dark {\n${variables.map((v) => `  --${v.path.join('-')}: ${value(v.modes.Dark)};`).join('\n')}\n}\n`;
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
    const light = modes.Light ?? modes.Default;
    setPath(out, [collectionSlug(tier), ...path], {
      $type: 'color',
      $value: ref(light),
      ...(t.description && { $description: t.description }),
      ...(modes.Dark && { $extensions: { modes: { dark: ref(modes.Dark) } } }),
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
