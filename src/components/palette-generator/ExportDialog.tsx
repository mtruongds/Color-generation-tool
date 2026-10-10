import { useMemo, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { ColorFormat } from '../../lib/color-utils';
import { copyToClipboard } from '../../lib/clipboard';
import {
  GeneratedPalette,
  downloadFile,
  generateCssVariables,
  generateFigmaTokens,
  generateJsonTokens,
  generateSheetCsv,
} from '../../lib/export-utils';

type ExportKind = 'css' | 'json' | 'figma' | 'csv';

const EXPORTS: Record<
  ExportKind,
  { label: string; hint: string; filename: string; mime: string; usesFormat: boolean }
> = {
  css: {
    label: 'CSS',
    hint: 'Custom properties for solid and alpha steps.',
    filename: 'colors.css',
    mime: 'text/css',
    usesFormat: true,
  },
  json: {
    label: 'JSON',
    hint: 'Design tokens with values, types and usage notes.',
    filename: 'colors.json',
    mime: 'application/json',
    usesFormat: true,
  },
  figma: {
    label: 'Figma',
    hint: 'Import into Figma variables (W3C token format, sRGB).',
    filename: 'Color.tokens.json',
    mime: 'application/json',
    usesFormat: false,
  },
  csv: {
    label: 'Sheets CSV',
    hint: 'Light and dark values side by side for Google Sheets.',
    filename: 'design-system-colors.csv',
    mime: 'text/csv;charset=utf-8',
    usesFormat: false,
  },
};

export function ExportDialog({
  open,
  onOpenChange,
  palettes,
  colorFormat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  palettes: GeneratedPalette[];
  colorFormat: ColorFormat;
}) {
  const [kind, setKind] = useState<ExportKind>('css');
  const [copied, setCopied] = useState(false);
  const meta = EXPORTS[kind];

  const content = useMemo(() => {
    if (!open) return '';
    switch (kind) {
      case 'css':
        return generateCssVariables(palettes, colorFormat);
      case 'json':
        return generateJsonTokens(palettes, colorFormat);
      case 'figma':
        return generateFigmaTokens(palettes);
      case 'csv':
        return generateSheetCsv(palettes);
    }
  }, [open, kind, palettes, colorFormat]);

  const lineCount = useMemo(() => content.split('\n').length, [content]);

  const handleCopy = () => {
    copyToClipboard(content, meta.label);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 text-left">
          <DialogTitle>Export tokens</DialogTitle>
          <DialogDescription>
            {palettes.length} {palettes.length === 1 ? 'palette' : 'palettes'} · 12 solid + 12 alpha
            steps each
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-3">
          <Tabs value={kind} onValueChange={(v) => setKind(v as ExportKind)} className="gap-0">
            <TabsList className="h-8 rounded-lg">
              {(Object.keys(EXPORTS) as ExportKind[]).map((k) => (
                <TabsTrigger key={k} value={k} className="rounded-md px-3 text-xs">
                  {EXPORTS[k].label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground">
            {meta.hint}
            {meta.usesFormat && (
              <span className="ml-1 font-mono uppercase">({colorFormat})</span>
            )}
          </p>
        </div>

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
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            size="sm"
            onClick={() => downloadFile(content, meta.filename, meta.mime)}
          >
            <Download />
            Download {meta.filename}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
