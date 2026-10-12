import { Moon, Sun } from 'lucide-react';
import {
  ColorFormat,
  formatScaleColor,
  generateAlphaScale,
  getContrast,
  getWCAGRating,
} from '../../lib/color-utils';
import {
  GeneratedPalette,
  STEP_USAGE,
  modeTokenName,
} from '../../lib/export-utils';
import { cn } from '../ui/utils';

function alphaBadgeClass(alpha: number) {
  if (alpha <= 0.1) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (alpha <= 0.3) return 'bg-sky-500/10 text-sky-700 dark:text-sky-300';
  if (alpha <= 0.6) return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'bg-rose-500/10 text-rose-700 dark:text-rose-300';
}

function ContrastLine({ label, ratio }: { label: string; ratio: number }) {
  const rating = getWCAGRating(ratio);
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 text-[0.625rem] text-muted-foreground">{label}</span>
      <span className="w-7 font-mono text-xs tabular">{ratio.toFixed(1)}</span>
      {rating.label !== 'Fail' && (
        <span
          className={cn(
            'rounded px-1 py-px text-[0.5625rem] font-medium',
            rating.label === 'AAA'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {rating.label}
        </span>
      )}
    </div>
  );
}

interface PaletteDocumentationProps {
  palettes: GeneratedPalette[];
  colorFormat?: ColorFormat;
}

export function PaletteDocumentation({ palettes, colorFormat = 'hex' }: PaletteDocumentationProps) {
  return (
    <div className="space-y-12 pb-16">
      <div className="flex flex-col items-start justify-between gap-4 border-b pb-6 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Color reference</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Token names, values, contrast and recommended usage for every step of the design system
            palette.
          </p>
        </div>
      </div>

      {palettes.map((palette) => {
        const s = palette.scale.colors;
        const alphaScale = generateAlphaScale(palette.scale, palette.isDark);
        const token = modeTokenName(palette.name, palette.isDark);

        return (
          <section key={palette.id} id={`palette-${palette.id}`} className="scroll-mt-6 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className="swatch-outline size-5 rounded-md" style={{ backgroundColor: palette.baseColor }} />
                <h2 className="text-xl font-semibold tracking-tight">{palette.name}</h2>
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
                  {palette.isDark ? <Moon className="size-3" /> : <Sun className="size-3" />}
                  {palette.isDark ? 'Dark' : 'Light'}
                </span>
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground">
                {palette.description ||
                  `The ${palette.name} scale covers ${palette.name.toLowerCase()} actions, states and surfaces — 12 steps from background tints to high-contrast text.`}
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card shadow-card">
              <div className="flex h-10">
                {s.map((color, i) => (
                  <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                ))}
              </div>
              <div className="checkerboard flex h-5">
                {alphaScale.colors.map((alpha, i) => (
                  <div key={i} className="flex-1" style={{ backgroundColor: alpha.rgba }} />
                ))}
              </div>

              <div className="overflow-x-auto border-t">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Token</th>
                      <th className="px-4 py-2.5 font-medium">Preview</th>
                      <th className="px-4 py-2.5 font-medium">{colorFormat === 'oklch' ? 'OKLCH' : 'HEX'}</th>
                      <th className="px-4 py-2.5 font-medium">Alpha</th>
                      <th className="px-4 py-2.5 font-medium">Contrast W / B</th>
                      <th className="px-4 py-2.5 font-medium">Usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {s.map((color, i) => {
                      const alpha = alphaScale.colors[i];
                      return (
                        <tr key={i} className="transition-colors hover:bg-muted/30">
                          <td className="px-4 py-2">
                            <div className="font-mono text-xs">
                              {token}-{i + 1}
                            </div>
                            <div className="font-mono text-[0.6875rem] text-muted-foreground">
                              {token}-a{i + 1}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <span className="swatch-outline size-7 rounded-md" style={{ backgroundColor: color }} title={`Solid: ${color}`} />
                              <span className="checkerboard size-7 overflow-hidden rounded-md" title={`Alpha: ${alpha.rgba}`}>
                                <span className="block size-full" style={{ backgroundColor: alpha.rgba }} />
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs whitespace-nowrap text-muted-foreground">
                            {formatScaleColor(palette.scale, i, colorFormat)}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span className={cn('rounded px-1.5 py-0.5 font-mono text-[0.625rem] tabular', alphaBadgeClass(alpha.alpha))}>
                                {Math.round(alpha.alpha * 100)}%
                              </span>
                              <span className="font-mono text-[0.6875rem] whitespace-nowrap text-muted-foreground">
                                {alpha.rgba}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <ContrastLine label="W" ratio={getContrast(color, '#ffffff')} />
                            <ContrastLine label="B" ratio={getContrast(color, '#000000')} />
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{STEP_USAGE[i]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </section>
        );
      })}
    </div>
  );
}
