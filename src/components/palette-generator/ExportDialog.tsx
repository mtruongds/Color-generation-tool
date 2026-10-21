import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
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
import { ColorFormat } from '../../lib/color-utils';
import { copyToClipboard } from '../../lib/clipboard';
import { GeneratedPalette, downloadFile, generateSheetCsv } from '../../lib/export-utils';
import {
  type ExportScope,
  type FigmaScope,
  type LengthUnit,
  figmaFilename,
  generateCss,
  generateFigma,
  generateJson,
  generateTailwind,
} from '../../lib/foundation-export';
import { primitiveColorNames } from '../../lib/tokens';
import type { Foundations } from '../../lib/foundations';
import { FOUNDATION_META, FOUNDATION_ORDER } from '../foundations/FoundationNav';

type ExportKind = 'css' | 'tailwind' | 'json' | 'figma' | 'csv';

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
  tailwind: {
    label: 'Tailwind',
    hint: 'The same tiers, with base and semantic tokens exposed as Tailwind v4 utilities.',
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
  figma: {
    label: 'Figma',
    hint: 'One Figma collection with primitive, base and semantic groups.',
    mime: 'application/json',
    ext: 'json',
    // Shadows are effect styles in Figma, not variables
    scopes: ['color', 'typography', 'spacing', 'radius', 'grid'],
  },
  csv: { label: 'Sheets CSV', hint: 'Primitive colors, light rows then dark rows, for Google Sheets.', mime: 'text/csv;charset=utf-8', ext: 'csv', scopes: ['color'] },
};

const supports = (kind: ExportKind, scope: ExportScope) => {
  const { scopes } = EXPORTS[kind];
  return scopes === 'any' || scopes.includes(scope);
};

const SCOPE_LABEL: Record<ExportScope, string> = {
  all: 'All foundations',
  ...(Object.fromEntries(FOUNDATION_ORDER.map((k) => [k, FOUNDATION_META[k].label])) as Record<Exclude<ExportScope, 'all'>, string>),
};

function filenameFor(kind: ExportKind, scope: ExportScope, isDark: boolean) {
  if (kind === 'figma') return figmaFilename(scope as FigmaScope, isDark);
  if (kind === 'csv') return 'color.csv';
  const base = scope === 'all' ? 'tokens' : scope;
  return kind === 'tailwind' ? `${base}.theme.css` : `${base}.${EXPORTS[kind].ext}`;
}

export function ExportDialog({
  open,
  onOpenChange,
  palettes,
  colorFormat,
  foundations,
  isDark,
  initialScope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  palettes: GeneratedPalette[];
  colorFormat: ColorFormat;
  foundations: Foundations;
  isDark: boolean;
  /** The foundation on screen when the dialog opens. */
  initialScope: ExportScope;
}) {
  const [kind, setKind] = useState<ExportKind>('css');
  const [scope, setScope] = useState<ExportScope>(initialScope);
  const [unit, setUnit] = useState<LengthUnit>('rem');
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
  const filename = filenameFor(activeKind, scope, isDark);
  const usesColorFormat = (scope === 'all' || scope === 'color') && ['css', 'json', 'tailwind'].includes(activeKind);
  const usesUnit = scope !== 'color' && ['css', 'json', 'tailwind'].includes(activeKind);

  const content = useMemo(() => {
    if (!open) return '';
    const opts = { scope, unit, colorFormat };
    switch (activeKind) {
      case 'css':
        return generateCss(palettes, foundations, opts);
      case 'tailwind':
        return generateTailwind(palettes, foundations, opts);
      case 'json':
        return generateJson(palettes, foundations, opts);
      case 'figma':
        return generateFigma(palettes, foundations, scope as FigmaScope, { isDark, colorFormat });
      case 'csv': {
        const names = primitiveColorNames(palettes);
        return generateSheetCsv(palettes, (p) => names.get(p.id)!);
      }
    }
  }, [open, activeKind, scope, unit, palettes, colorFormat, foundations, isDark]);

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
        <p className="px-6 pb-3 text-xs text-muted-foreground">
          {meta.hint}
          {usesColorFormat && <span className="ml-1 font-mono uppercase">({colorFormat})</span>}
          {activeKind === 'figma' && scope === 'color' && (
            <> {isDark ? 'Dark' : 'Light'} mode — switch the theme and export again to add the other mode.</>
          )}
          {(activeKind === 'css' || activeKind === 'tailwind') && (scope === 'all' || scope === 'color' || scope === 'shadow') && (
            <> Put the <code className="font-mono">dark</code> class on &lt;html&gt;.</>
          )}
        </p>

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
