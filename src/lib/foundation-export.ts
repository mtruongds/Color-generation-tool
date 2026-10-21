import chroma from 'chroma-js';
import type { ColorFormat } from './color-utils';
import type { GeneratedPalette } from './export-utils';
import { type Foundations, type ShadowLayer, layerToCss } from './foundations';
import { TIERS, type Token, type TokenGroup, buildTokens } from './tokens';

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
// Tailwind v4
// ============================================================

/**
 * The same tiered variables as the CSS export, plus a `@theme inline` block that turns base and
 * semantic tokens into utilities (bg-bg-brand, text-h1, p-card, rounded-control, shadow-dialog).
 */
export function generateTailwind(palettes: GeneratedPalette[], f: Foundations, opts: ExportOptions) {
  const tokens = buildTokens(palettes, f, { groups: groupsFor(opts.scope), modes: 'both', colorFormat: opts.colorFormat });
  const themed = tokens.filter((t) => t.tw);
  let css = '@import "tailwindcss";\n\n';
  if (tokens.some((t) => t.darkRef)) css += '@custom-variant dark (&:where(.dark, .dark *));\n\n';
  css += variablesCss(tokens, opts.unit);
  if (themed.length) {
    const lines = themed.map((t) => `  --${t.tw}: ${t.twLiteral ? formatLength(t.value as number, 'rem') : `var(--${t.name})`};`);
    // `reference` creates the utilities without redeclaring the variables, which already live in :root above
    css += `\n/* ===== Tailwind utilities from base and semantic tokens ===== */\n@theme inline reference {\n${lines.join('\n')}\n}\n`;
  }
  return css;
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
    if (t.darkRef) extensions['lumina.modes'] = { dark: alias(t.darkRef) };
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
// Figma variables
// ============================================================

/** Shadows are effect styles in Figma, not variables, so they have no Figma export. */
export type FigmaScope = Exclude<TokenGroup, 'shadow'>;

const COLLECTION_NAMES: Record<FigmaScope, string> = {
  color: 'Color',
  typography: 'Typography',
  spacing: 'Spacing',
  radius: 'Radius',
  grid: 'Layout',
};

/** Figma's importer names the mode after the file and ignores `com.figma.modeName`, so color files are named by mode. */
export const figmaFilename = (scope: FigmaScope, isDark: boolean) =>
  `${scope === 'color' ? (isDark ? 'Dark' : 'Light') : COLLECTION_NAMES[scope]}.tokens.json`;

/**
 * Where each variable can be applied in Figma. Primitives and base tokens get none, so they stay
 * out of the pickers and designers only apply semantic tokens, each where its usage says.
 * The empty list is written out on purpose: Figma reads a missing key as all scopes.
 */
function figmaScopes(t: Token): string[] {
  if (t.tier !== 'semantic') return [];
  const leaf = t.path.at(-1)!;
  switch (t.group) {
    case 'color':
      if (t.name.startsWith('bg')) return ['FRAME_FILL', 'SHAPE_FILL'];
      // Text and icons, which are vector shapes
      if (t.name.startsWith('fg')) return ['TEXT_FILL', 'SHAPE_FILL'];
      // Figma's JSON names the stroke scope STROKE, and drops STROKE_COLOR on import
      if (t.name.startsWith('border')) return ['STROKE'];
      // Focus rings are drawn as strokes or spread shadows
      if (t.name.startsWith('focus')) return ['STROKE', 'EFFECT_COLOR'];
      return ['ALL_FILLS', 'STROKE'];
    case 'typography':
      if (t.type === 'fontFamily') return ['FONT_FAMILY'];
      // Figma's JSON names the "Font weight" property FONT_STYLE, and drops FONT_WEIGHT on import
      if (t.type === 'fontWeight') return ['FONT_STYLE'];
      if (t.type === 'letterSpacing') return ['LETTER_SPACING'];
      return leaf.startsWith('line-height') ? ['LINE_HEIGHT'] : ['FONT_SIZE'];
    case 'radius':
      return ['CORNER_RADIUS'];
    // Figma's gap scope covers auto layout padding too
    case 'spacing':
      return ['GAP'];
    case 'grid':
      if (t.name === 'page-gutter' || t.name === 'page-margin') return ['GAP'];
      if (t.name === 'page-max-width' || t.name === 'page-sidebar') return ['WIDTH_HEIGHT'];
      // Column count has no Figma scope of its own, so it stays out of the pickers
      return t.type === 'number' ? [] : ['WIDTH_HEIGHT', 'GAP'];
    default:
      return [];
  }
}

function figmaRawValue(t: Token): unknown {
  if (t.type === 'color') {
    const c = chroma(t.value as string);
    const [r, g, b] = c.rgb();
    return { colorSpace: 'srgb', components: [r / 255, g / 255, b / 255], alpha: c.alpha(), hex: c.hex('rgb') };
  }
  return t.value;
}

/**
 * One collection per file, with the three tiers as root groups. Aliases use the W3C `{path}` syntax.
 * Color exports one mode per file — export light and dark to get both modes.
 */
export function generateFigma(palettes: GeneratedPalette[], f: Foundations, scope: FigmaScope, opts: { isDark: boolean; colorFormat: ColorFormat }) {
  const tokens = buildTokens(palettes, f, { groups: [scope], modes: opts.isDark ? 'dark' : 'light', colorFormat: 'hex' });
  const byName = new Map(tokens.map((t) => [t.name, t]));
  const alias = (name: string) => {
    const t = byName.get(name);
    return t ? `{${[t.tier, ...t.path].join('.')}}` : `{${name}}`;
  };
  const collection: Record<string, unknown> = {};

  const write = (t: Token, path: string[], ref: string | undefined, value: unknown) =>
    setPath(collection, [t.tier, ...path], {
      $type: t.type === 'letterSpacing' || t.type === 'fontWeight' ? 'number' : t.type === 'fontFamily' ? 'string' : t.type === 'dimension' ? 'number' : t.type,
      $value: ref ? alias(ref) : value,
      ...(t.description && { $description: t.description }),
      $extensions: { 'com.figma.scopes': figmaScopes(t) },
    });

  for (const t of tokens) {
    // Figma letter spacing is in px or %, never em; percent of the font size matches em × 100
    if (t.type === 'letterSpacing' && !t.ref) {
      write(t, t.path, undefined, Math.round((t.value as number) * 1000) / 10);
      continue;
    }
    if (!t.responsive?.length) {
      write(t, t.path, t.ref, t.ref ? undefined : figmaRawValue(t));
      continue;
    }
    // No breakpoints in Figma: the widest value takes the plain name, the others get a suffix
    const entries = [{ label: t.baseLabel ?? 'base', ref: t.ref! }, ...t.responsive.map((r) => ({ label: r.label, ref: r.ref }))];
    const widest = entries.at(-1)!;
    write(t, t.path, widest.ref, undefined);
    for (const e of entries.slice(0, -1)) write(t, [...t.path.slice(0, -1), `${t.path.at(-1)}-${e.label}`], e.ref, undefined);
  }

  // Tiers sit at the file root, as Figma exports them: aliases resolve from the root, so wrapping
  // them in a collection key breaks every base and semantic reference. Figma names the collection
  // from the import dialog (the filename suggests it).
  const modeName = scope === 'color' ? (opts.isDark ? 'Dark' : 'Light') : 'Default';
  return JSON.stringify({ ...collection, $extensions: { 'com.figma.modeName': modeName } }, null, 2);
}
