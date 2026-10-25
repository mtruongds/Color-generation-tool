import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, TriangleAlert } from 'lucide-react';
import { Button } from '../ui/button';
import { IconSwap } from '../ui/icon-swap';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../ui/utils';
import { ColorFormat } from '../../lib/color-utils';
import { copyToClipboard } from '../../lib/clipboard';
import { GeneratedPalette, downloadFile } from '../../lib/export-utils';
import {
  COLOR_COLLECTIONS,
  type ColorCollection,
  type ExportScope,
  type LengthUnit,
  colorCollectionFilename,
  generateColorCollectionCss,
  generateColorCollectionCsv,
  generateColorCollectionJson,
  generateCss,
  generateEffectStylesCsv,
  generateShadowStylesCss,
  generateShadowStylesJson,
  generateShadowVariablesCsv,
  generateJson,
  generateSheetVariablesCsv,
  generateTextStylesCsv,
  SHEET_COLLECTIONS,
  SHADOW_COLLECTION,
  SHEET_FILENAMES,
  type SheetGroup,
  sheetFilename,
} from '../../lib/foundation-export';
import type { Foundations } from '../../lib/foundations';
import { ROLE_LABELS, TIERS, inheritedBrandRoles, productSlug, productsOf } from '../../lib/tokens';
import { FOUNDATION_META, FOUNDATION_ORDER } from '../foundations/FoundationNav';

type ExportKind = 'css' | 'json' | 'csv';

const EXPORTS: Record<
  ExportKind,
  { label: string; hint: string; mime: string; ext: string; scopes: ExportScope[] | 'any' }
> = {
  css: {
    label: 'CSS',
    hint: 'Primitive, base and semantic custom properties, light and dark, plus text and grid classes.',
    mime: 'text/css',
    ext: 'css',
    scopes: 'any',
  },
  json: {
    label: 'JSON',
    hint: 'W3C design tokens grouped by tier, with aliases and dark-mode values.',
    mime: 'application/json',
    ext: 'json',
    scopes: 'any',
  },
  csv: {
    label: 'Sheets CSV',
    hint: 'One collection or style set per sheet, for the Sheet Variable Importer plugin.',
    mime: 'text/csv;charset=utf-8',
    ext: 'csv',
    scopes: FOUNDATION_ORDER,
  },
};

const supports = (kind: ExportKind, scope: ExportScope) => {
  const { scopes } = EXPORTS[kind];
  return scopes === 'any' || scopes.includes(scope);
};

const SCOPE_LABEL: Record<ExportScope, string> = {
  all: 'All foundations',
  ...(Object.fromEntries(FOUNDATION_ORDER.map((k) => [k, FOUNDATION_META[k].label])) as Record<Exclude<ExportScope, 'all'>, string>),
};

/** Color exports as CSS, JSON and Sheets split into the Color Palette, Color and Theme collections. */
const COLLECTION_HINTS: Record<ExportKind, Record<ColorCollection, string>> = {
  css: {
    primitive: 'Raw palette steps, light and -dark side by side.',
    base: 'Roles aliasing Color Palette, light and -dark side by side. Load color-palette.css first.',
    semantic: 'Purposes aliasing Color, with dark values under [data-theme="dark"]. Load color.css first.',
  },
  json: {
    primitive: 'Raw palette steps, light and -dark side by side, as W3C design tokens.',
    base: 'Roles aliasing {color-palette.…}, light and -dark side by side. Merge with color-palette.json.',
    semantic: 'Purposes aliasing {color.…}, with the dark alias in $extensions. Merge with color.json.',
  },
  csv: {
    primitive: 'Raw palette steps, light and -dark side by side, in one mode. _OKLCH is for reference; the plugin skips it.',
    base: 'Roles aliasing Color Palette, light and -dark side by side. Import Color Palette first.',
    semantic: 'Purposes aliasing Color, with Light and Dark modes. Import Color first.',
  },
};

/** Sheets CSV for the foundations that split into collections like Color. */
const SHEET_GROUPS: ExportScope[] = ['typography', 'spacing', 'radius', 'grid'];
const isSheetGroup = (scope: ExportScope): scope is SheetGroup => SHEET_GROUPS.includes(scope);

/** A tier's collection, or the styles built on one: Typography's text styles, Shadow's effect styles. */
type SheetPart = ColorCollection | 'text-styles' | 'effect-styles';

const isTier = (p: SheetPart): p is ColorCollection => p !== 'text-styles' && p !== 'effect-styles';

/** Shadow's one collection sits in the primitive slot, then the styles bound to it. */
const SHADOW_PARTS: SheetPart[] = ['primitive', 'effect-styles'];

const SHADOW_HINTS: Partial<Record<SheetPart, string>> = {
  primitive: 'One color per shadow layer, with Light and Dark modes (per product once one has its own tint), scoped to Effects. Import this first.',
  'effect-styles': `Effect styles for the Shadow Styles tab, levels under shadow/ and custom purposes under container/, each layer's color bound to ${SHADOW_COLLECTION}, so one set follows Light and Dark. Import ${SHADOW_COLLECTION} first.`,
};

/** Where a collection's modes come from, when it has any. */
const SHEET_MODES: Partial<Record<SheetGroup, string>> = {
  typography: ' Sizes switch between Mobile and Desktop modes.',
  radius: ' Gets a mode per product once one has its own radius.',
  grid: ' Columns, gutter and margin get a mode per breakpoint.',
};

function sheetHint(group: SheetGroup, part: SheetPart) {
  const names = SHEET_COLLECTIONS[group];
  if (part === 'text-styles') return `One text style per role for the Text Styles tab, bound to ${names.semantic}. Import ${names.semantic} first.`;
  if (part === 'primitive') return 'Raw values in one mode, with no scope. Import this first.';
  if (part === 'base') return `Roles aliasing ${names.primitive}, with no scope. Import ${names.primitive} first.${SHEET_MODES[group] ?? ''}`;
  return `Purposes aliasing ${names.base}, scoped for Figma's pickers. Import ${names.base} first.`;
}

function filenameFor(kind: ExportKind, scope: ExportScope, colorTier: ColorCollection, sheetPart: SheetPart) {
  if (scope === 'color') return colorCollectionFilename(colorTier, kind);
  if (kind === 'csv') {
    if (scope === 'shadow') return sheetPart === 'effect-styles' ? SHEET_FILENAMES['effect-styles'] : `${SHADOW_COLLECTION}.csv`;
    if (isSheetGroup(scope)) return isTier(sheetPart) ? sheetFilename(scope, sheetPart) : SHEET_FILENAMES[sheetPart];
  }
  const base = scope === 'all' ? 'tokens' : scope === 'shadow' ? 'shadow-styles' : scope;
  return `${base}.${EXPORTS[kind].ext}`;
}

export function ExportDialog({
  open,
  onOpenChange,
  palettes,
  colorFormat,
  foundations,
  initialScope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  palettes: GeneratedPalette[];
  colorFormat: ColorFormat;
  foundations: Foundations;
  /** The foundation on screen when the dialog opens. */
  initialScope: ExportScope;
}) {
  const [kind, setKind] = useState<ExportKind>('css');
  const [scope, setScope] = useState<ExportScope>(initialScope);
  const [unit, setUnit] = useState<LengthUnit>('rem');
  const [colorTier, setColorTier] = useState<ColorCollection>('primitive');
  const [chosenSheetPart, setSheetPart] = useState<SheetPart>('primitive');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) setScope(initialScope);
  }, [open, initialScope]);

  // Fall back to CSS when the chosen scope has no export in this format
  useEffect(() => {
    if (!supports(kind, scope)) setKind('css');
  }, [kind, scope]);

  const activeKind = supports(kind, scope) ? kind : 'css';
  const meta = EXPORTS[activeKind];
  const colorTierKind = scope === 'color' ? activeKind : null;
  const sheetGroup = activeKind === 'csv' && isSheetGroup(scope) ? scope : null;
  const shadowSheet = activeKind === 'csv' && scope === 'shadow';
  const sheetParts: SheetPart[] = sheetGroup
    ? [...TIERS, ...(sheetGroup === 'typography' ? (['text-styles'] as const) : [])]
    : shadowSheet
      ? SHADOW_PARTS
      : [];
  // A part the scope doesn't have falls back to its first collection
  const sheetPart: SheetPart = sheetParts.includes(chosenSheetPart) ? chosenSheetPart : 'primitive';
  const filename = filenameFor(activeKind, scope, colorTier, sheetPart);
  const usesColorFormat = (scope === 'all' || scope === 'color') && ['css', 'json'].includes(activeKind);
  // Shadow styles are always px, like Figma's effects
  const usesUnit = scope !== 'color' && scope !== 'shadow' && ['css', 'json'].includes(activeKind);

  const content = useMemo(() => {
    if (!open) return '';
    const opts = { scope, unit, colorFormat };
    switch (activeKind) {
      case 'css':
        if (scope === 'shadow') return generateShadowStylesCss(palettes, foundations);
        return scope === 'color' ? generateColorCollectionCss(palettes, foundations, colorTier, colorFormat) : generateCss(palettes, foundations, opts);
      case 'json':
        if (scope === 'shadow') return generateShadowStylesJson(palettes, foundations);
        return scope === 'color' ? generateColorCollectionJson(palettes, foundations, colorTier, colorFormat) : generateJson(palettes, foundations, opts);
      case 'csv':
        if (scope === 'color' || scope === 'all') return generateColorCollectionCsv(palettes, foundations, colorTier);
        if (scope === 'shadow') return sheetPart === 'effect-styles' ? generateEffectStylesCsv(palettes, foundations) : generateShadowVariablesCsv(palettes, foundations);
        if (!isTier(sheetPart)) return generateTextStylesCsv(palettes, foundations);
        return generateSheetVariablesCsv(palettes, foundations, scope, sheetPart);
    }
  }, [open, activeKind, scope, unit, palettes, colorFormat, foundations, colorTier, sheetPart]);

  // Products only change the Color collection, so the notes show where that is exported
  const products = productsOf(foundations);
  const showsProducts = products.length > 1 && (scope === 'all' || (scope === 'color' && colorTier === 'base'));
  const inheritedBrand = useMemo(
    () => (showsProducts ? inheritedBrandRoles(palettes, products) : []),
    [showsProducts, palettes, products],
  );

  const lineCount = useMemo(() => content.split('\n').length, [content]);

  const handleCopy = () => {
    copyToClipboard(content, meta.label);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl grid-cols-[minmax(0,1fr)] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 text-left">
          <DialogTitle>Export tokens</DialogTitle>
          <DialogDescription>
            {scope === 'all'
              ? `${palettes.length} color ${palettes.length === 1 ? 'palette' : 'palettes'}, plus typography, spacing, radius, shadow and grid`
              : `${SCOPE_LABEL[scope]} tokens`}
            {' · primitive → base → semantic'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
          <Select value={scope} onValueChange={(v) => setScope(v as ExportScope)}>
            <SelectTrigger size="sm" className="w-[10.5rem]" aria-label="What to export">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['all', ...FOUNDATION_ORDER] as ExportScope[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SCOPE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={activeKind} onValueChange={(v) => setKind(v as ExportKind)} className="gap-0">
            <TabsList className="h-8 rounded-lg">
              {(Object.keys(EXPORTS) as ExportKind[])
                .filter((k) => supports(k, scope))
                .map((k) => (
                  <TabsTrigger key={k} value={k} className="rounded-md px-3 text-xs">
                    {EXPORTS[k].label}
                  </TabsTrigger>
                ))}
            </TabsList>
          </Tabs>

          {usesUnit && (
            <Tabs value={unit} onValueChange={(v) => setUnit(v as LengthUnit)} className="ml-auto gap-0">
              <TabsList className="h-8 rounded-lg" aria-label="Length unit">
                <TabsTrigger value="rem" className="rounded-md px-2 font-mono text-[0.6875rem]">
                  rem
                </TabsTrigger>
                <TabsTrigger value="px" className="rounded-md px-2 font-mono text-[0.6875rem]">
                  px
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
        {colorTierKind && (
          <div className="flex flex-wrap gap-1.5 px-6 pb-3" role="group" aria-label="Collection">
            {(Object.keys(COLOR_COLLECTIONS) as ColorCollection[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setColorTier(t)}
                aria-pressed={colorTier === t}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  colorTier === t ? 'border-foreground/40 bg-accent text-foreground' : 'text-muted-foreground',
                )}
              >
                {COLOR_COLLECTIONS[t]}
              </button>
            ))}
          </div>
        )}
        {sheetParts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-6 pb-3" role="group" aria-label="Collection">
            {sheetParts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSheetPart(p)}
                aria-pressed={sheetPart === p}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  sheetPart === p ? 'border-foreground/40 bg-accent text-foreground' : 'text-muted-foreground',
                )}
              >
                {p === 'text-styles'
                  ? 'Text Styles'
                  : p === 'effect-styles'
                    ? 'Shadow Styles'
                    : sheetGroup
                      ? SHEET_COLLECTIONS[sheetGroup][p]
                      : SHADOW_COLLECTION}
              </button>
            ))}
          </div>
        )}
        <p className="px-6 pb-3 text-xs text-muted-foreground">
          {colorTierKind
            ? COLLECTION_HINTS[colorTierKind][colorTier]
            : shadowSheet
              ? SHADOW_HINTS[sheetPart]
              : scope === 'shadow'
                ? `Levels under shadow, and custom purposes under container, resolved per mode${activeKind === 'css' ? '' : ', Light and Dark at the root'}.`
              : sheetGroup
                ? sheetHint(sheetGroup, sheetPart)
                : meta.hint}
          {usesColorFormat && <span className="ml-1 font-mono uppercase">({colorFormat})</span>}
          {activeKind === 'css' && (scope === 'all' || scope === 'shadow' || (scope === 'color' && colorTier === 'semantic')) && (
            <> Put <code className="font-mono">data-theme="dark"</code> on &lt;html&gt; for dark mode.</>
          )}
          {showsProducts && activeKind === 'css' && (
            <>
              {' '}Switch products with <code className="font-mono">data-product="{productSlug(products[1].name)}"</code> on &lt;html&gt;.
            </>
          )}
          {showsProducts && activeKind === 'csv' && <> One mode per product: {products.map((p) => p.name).join(', ')}.</>}
        </p>
        {inheritedBrand.length > 0 && (
          <ul className="mx-6 mb-3 flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            {inheritedBrand.map(({ product, role, paletteId }) => (
              <li key={`${product.id}-${role}`} className="flex items-start gap-1.5">
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                <span>
                  {product.name} uses {products[0].name}'s {ROLE_LABELS[role]} ({palettes.find((p) => p.id === paletteId)?.name}).
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="relative mx-6 rounded-lg border bg-zinc-950 text-zinc-100 dark:bg-black/40">
          <pre className="scrollbar-thin max-h-[22rem] overflow-auto p-4 font-mono text-[0.75rem] leading-relaxed">
            {content}
          </pre>
          <span className="pointer-events-none absolute right-3 bottom-2 font-mono text-[0.625rem] text-zinc-500">
            {lineCount} lines
          </span>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t bg-muted/40 px-6 py-3">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <IconSwap active={copied} on={<Check />} off={<Copy />} />
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button size="sm" onClick={() => downloadFile(content, filename, meta.mime)}>
            <Download />
            Download {filename}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
