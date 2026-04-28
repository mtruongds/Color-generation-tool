import { useState, useMemo } from 'react';
import { Copy, Check, ChevronDown, ArrowRightLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  ColorScale,
  getContrast,
  getAPCA,
  getAPCARating,
  getWCAGRating,
  generateAlphaScale,
  AlphaColorScale,
  formatAlphaColor,
  formatColor,
  ColorFormat,
} from '../../lib/color-utils';
import { copyToClipboard } from '../../lib/clipboard';
import { PaletteConfig } from './types';
import chroma from 'chroma-js';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';

// ---------- Helpers ----------

function getTextColor(color: string): string {
  const apcaWhite = Math.abs(getAPCA('#ffffff', color));
  const apcaBlack = Math.abs(getAPCA('#000000', color));
  return apcaWhite > apcaBlack ? 'text-white/90' : 'text-black/80';
}

// ---------- PaletteDisplay ----------

export function PaletteDisplay({ palette, colorFormat = 'hex' }: { palette: PaletteConfig & { scale: ColorScale }; colorFormat?: ColorFormat }) {
  const [view, setView] = useState<'scale' | 'alpha' | 'contrast'>('scale');
  const [alphaFormat, setAlphaFormat] = useState<'rgba' | 'hsla' | 'hex8'>('rgba');

  const alphaScale = useMemo(
    () => generateAlphaScale(palette.scale, palette.isDark),
    [palette.scale, palette.isDark],
  );

  return (
    <Card id={`palette-${palette.id}`} className="overflow-hidden border shadow-sm rounded-xl">
      <CardHeader className="pb-[1rem] border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[0.5rem]">
            <div className="h-[1rem] w-[1rem] rounded-full" style={{ backgroundColor: palette.baseColor }} />
            <CardTitle className="text-[1.125rem]">{palette.name}</CardTitle>
          </div>
          <div className="flex items-center gap-[0.5rem]">
            <Tabs value={view} onValueChange={(v: string) => setView(v as 'scale' | 'alpha' | 'contrast')} className="flex-col-0 gap-0">
              <TabsList className="h-[2rem] rounded-lg bg-muted p-[0.25rem]">
                <TabsTrigger value="scale" className="h-[1.5rem] text-[0.75rem] px-[0.625rem] rounded-md">
                  Solid
                </TabsTrigger>
                <TabsTrigger value="alpha" className="h-[1.5rem] text-[0.75rem] px-[0.625rem] rounded-md">
                  Alpha
                </TabsTrigger>
                <TabsTrigger value="contrast" className="h-[1.5rem] text-[0.75rem] px-[0.625rem] rounded-md">
                  Contrast
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="text-[0.75rem] font-mono text-muted-foreground ml-[0.5rem]">
              {palette.isDark ? 'Dark Scale' : 'Light Scale'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {view === 'scale' ? (
          <>
            {/* Color strip */}
            <div className="flex flex-col md:flex-row h-auto md:h-[8rem] divide-y md:divide-y-0 md:divide-x divide-black/5 dark:divide-white/5">
              {palette.scale.colors.map((color, i) => {
                const textColor = getTextColor(color);
                return (
                  <div
                    key={i}
                    className="flex-1 flex md:flex-col items-center justify-between p-[0.5rem] md:p-[1rem] relative group cursor-pointer transition-all hover:brightness-110"
                    style={{ backgroundColor: color }}
                    onClick={() => copyToClipboard(formatColor(color, colorFormat))}
                    title={`Click to copy ${formatColor(color, colorFormat)}`}
                  >
                    {/* Lock/auto indicator – step 9 */}
                    {i === 8 && (
                      <div className="absolute top-[0.25rem] right-[0.25rem] md:top-[0.5rem] md:right-[0.5rem]">
                        <div
                          className={`h-[1rem] w-[1rem] rounded-full backdrop-blur-sm flex items-center justify-center ${palette.lockStep9 ? 'bg-black/20 dark:bg-white/20' : 'bg-emerald-500/30'
                            }`}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={textColor}
                          >
                            {palette.lockStep9 ? (
                              <>
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </>
                            ) : (
                              <>
                                <path d="M12 2a6 6 0 0 0-6 6v4" />
                                <rect x="3" y="12" width="18" height="10" rx="2" />
                                <circle cx="12" cy="17" r="1" />
                              </>
                            )}
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Hover indicator – step 10 */}
                    {i === 9 && (
                      <div className="absolute top-[0.25rem] right-[0.25rem] md:top-[0.5rem] md:right-[0.5rem]">
                        <div className="h-[1rem] w-[1rem] rounded-full bg-black/20 dark:bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={textColor}
                          >
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                          </svg>
                        </div>
                      </div>
                    )}

                    <span className={`text-[0.75rem] font-mono opacity-50 font-bold ${textColor}`}>
                      {i + 1}
                    </span>
                    <span className={`text-[0.6875rem] font-mono ${colorFormat === 'oklch' ? '' : 'uppercase'} ${textColor}`}>
                      {colorFormat === 'oklch'
                        ? (() => { const [l, c, h] = chroma(color).oklch(); return `${(l * 100).toFixed(1)} ${c.toFixed(3)}`; })()
                        : color.replace('#', '')}
                    </span>

                    {/* Copy indicator */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div
                        className={`px-[0.5rem] py-[0.25rem] rounded text-[0.625rem] font-medium backdrop-blur-sm ${palette.isDark
                          ? 'bg-white/20 text-white'
                          : i < 6
                            ? 'bg-black/20 text-white'
                            : 'bg-white/20 text-white'
                          }`}
                      >
                        <Copy className="h-[0.75rem] w-[0.75rem] inline mr-[0.25rem]" />
                        Copy
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Usage hints */}

          </>
        ) : view === 'alpha' ? (
          <AlphaScaleView
            alphaScale={alphaScale}
            solidColors={palette.scale.colors}
            isDark={palette.isDark}
            paletteName={palette.name}
            alphaFormat={alphaFormat}
            setAlphaFormat={setAlphaFormat}
          />
        ) : (
          <PaletteContrast colors={palette.scale.colors} isDark={palette.isDark} />
        )}
      </CardContent>
    </Card>
  );
}

// ---------- AlphaScaleView ----------

function AlphaScaleView({
  alphaScale,
  solidColors,
  isDark,
  paletteName,
  alphaFormat,
  setAlphaFormat,
}: {
  alphaScale: AlphaColorScale;
  solidColors: string[];
  isDark: boolean;
  paletteName: string;
  alphaFormat: 'rgba' | 'hsla' | 'hex8';
  setAlphaFormat: (f: 'rgba' | 'hsla' | 'hex8') => void;
}) {
  const checkerBg = `repeating-conic-gradient(${isDark ? '#1a1a1a' : '#e5e5e5'} 0% 25%, ${isDark ? '#2a2a2a' : '#ffffff'} 0% 50%) 0 0 / 0.75rem 0.75rem`;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between px-[1rem] py-[0.75rem] bg-muted/20 border-b">
        <div className="flex items-center gap-[0.75rem]">
          <div className="flex items-center gap-[0.5rem]">
            <div className="h-[0.75rem] w-[0.75rem] rounded" style={{ backgroundColor: alphaScale.background }} />
            <span className="text-[0.75rem] text-muted-foreground">
              Background: <span className="font-mono">{alphaScale.background}</span>
            </span>
          </div>
          <span className="text-[0.75rem] text-muted-foreground/60">|</span>
          <span className="text-[0.75rem] text-muted-foreground">
            {paletteName}A — Transparent equivalents
          </span>
        </div>
        <div className="flex items-center gap-[0.5rem]">
          <Label className="text-[0.75rem] text-muted-foreground">Format:</Label>
          <div className="flex bg-muted rounded-md p-[0.125rem] gap-[0.125rem]">
            {(['rgba', 'hsla', 'hex8'] as const).map((fmt) => (
              <Button
                key={fmt}
                variant={alphaFormat === fmt ? 'secondary' : 'ghost'}
                size="sm"
                className="h-[1.25rem] text-[0.625rem] px-[0.5rem] font-mono"
                onClick={() => setAlphaFormat(fmt)}
              >
                {fmt.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Alpha strip with checkerboard */}
      <div className="relative">
        <div className="flex flex-col md:flex-row h-auto md:h-[9rem]" style={{ background: checkerBg }}>
          {alphaScale.colors.map((alphaColor, i) => {
            const textColor = getTextColor(solidColors[i]);
            return (
              <div
                key={i}
                className="flex-1 flex md:flex-col items-center justify-between p-[0.5rem] md:p-[0.75rem] relative group cursor-pointer transition-all hover:brightness-110"
                style={{ backgroundColor: alphaColor.rgba }}
                onClick={() => copyToClipboard(formatAlphaColor(alphaColor, alphaFormat))}
                title={`Click to copy ${formatAlphaColor(alphaColor, alphaFormat)}`}
              >
                <span className={`text-[0.75rem] font-mono opacity-50 font-bold ${textColor}`}>
                  {i + 1}A
                </span>
                <div className="flex flex-col items-center gap-[0.25rem]">
                  <span
                    className={`text-[0.625rem] font-mono px-[0.375rem] py-[0.125rem] rounded ${isDark ? 'bg-white/10 text-white/80' : 'bg-black/10 text-black/70'
                      }`}
                  >
                    {Math.round(alphaColor.alpha * 100)}%
                  </span>
                  <span
                    className={`text-[0.5625rem] font-mono truncate max-w-full opacity-0 group-hover:opacity-100 transition-opacity ${textColor}`}
                  >
                    {alphaFormat === 'hex8'
                      ? alphaColor.hex8.replace('#', '')
                      : alphaFormat === 'rgba'
                        ? `${alphaColor.r},${alphaColor.g},${alphaColor.b}`
                        : `${Math.round(chroma(alphaColor.r, alphaColor.g, alphaColor.b).get('hsl.h') || 0)}deg`}
                  </span>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className={`px-[0.5rem] py-[0.25rem] rounded text-[0.625rem] font-medium backdrop-blur-sm ${isDark ? 'bg-white/20 text-white' : 'bg-black/20 text-white'}`}>
                    <Copy className="h-[0.75rem] w-[0.75rem] inline mr-[0.25rem]" />Copy
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Solid vs Alpha comparison */}
      <div className="border-t">
        <div className="px-[1rem] py-[0.5rem] bg-muted/10 flex items-center gap-[0.5rem]">
          <ArrowRightLeft className="h-[0.75rem] w-[0.75rem] text-muted-foreground" />
          <span className="text-[0.625rem] text-muted-foreground font-medium uppercase tracking-wider">Solid vs Alpha Comparison</span>
        </div>
        <div className="grid grid-cols-12 gap-0">
          {solidColors.map((solidColor, i) => {
            const alpha = alphaScale.colors[i];
            return (
              <div key={i} className="flex flex-col">
                <div className="h-[1.5rem]" style={{ backgroundColor: solidColor }} title={`Solid: ${solidColor}`} />
                <div className="h-[1.5rem] relative" style={{ backgroundColor: alphaScale.background }}>
                  <div className="absolute inset-0" style={{ backgroundColor: alpha.rgba }} title={`Alpha: ${alpha.rgba}`} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 text-[0.5625rem] text-muted-foreground border-t text-center">
          <div className="p-[0.25rem] border-r bg-muted/10">Solid</div>
          <div className="p-[0.25rem] bg-muted/10">Alpha (composited)</div>
        </div>
      </div>

      {/* Detailed alpha values table */}
      <div className="border-t">
        <div className="overflow-x-auto">
          <table className="w-full text-[0.75rem]">
            <thead>
              <tr className="bg-muted/30 text-muted-foreground">
                <th className="p-[0.5rem] text-left font-medium w-[4rem]">Step</th>
                <th className="p-[0.5rem] text-left font-medium">Alpha Value</th>
                <th className="p-[0.5rem] text-left font-medium w-[4rem]">Alpha %</th>
                <th className="p-[0.5rem] text-left font-medium w-[5rem]">Solid</th>
                <th className="p-[0.5rem] text-center font-medium w-[3rem]">Copy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {alphaScale.colors.map((alpha, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors group">
                  <td className="p-[0.5rem]">
                    <div className="flex items-center gap-[0.5rem]">
                      <div className="h-[1rem] w-[1rem] rounded border border-border/50" style={{ background: checkerBg }}>
                        <div className="h-full w-full rounded" style={{ backgroundColor: alpha.rgba }} />
                      </div>
                      <span className="font-mono font-medium">{i + 1}A</span>
                    </div>
                  </td>
                  <td className="p-[0.5rem]">
                    <span className="font-mono text-[0.6875rem]">{formatAlphaColor(alpha, alphaFormat)}</span>
                  </td>
                  <td className="p-[0.5rem]">
                    <span
                      className={`inline-block px-[0.375rem] py-[0.125rem] rounded text-[0.625rem] font-medium ${alpha.alpha <= 0.1
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                        : alpha.alpha <= 0.3
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                          : alpha.alpha <= 0.6
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                        }`}
                    >
                      {Math.round(alpha.alpha * 100)}%
                    </span>
                  </td>
                  <td className="p-[0.5rem]">
                    <div className="flex items-center gap-[0.375rem]">
                      <div className="h-[0.75rem] w-[0.75rem] rounded border border-border/50" style={{ backgroundColor: solidColors[i] }} />
                      <span className="font-mono text-muted-foreground text-[0.625rem]">{solidColors[i]}</span>
                    </div>
                  </td>
                  <td className="p-[0.5rem] text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-[1.5rem] w-[1.5rem] opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => copyToClipboard(formatAlphaColor(alpha, alphaFormat))}
                    >
                      <Copy className="h-[0.75rem] w-[0.75rem]" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------- PaletteContrast ----------

function PaletteContrast({ colors, isDark }: { colors: string[]; isDark: boolean }) {
  const [mode, setMode] = useState<'text-on-bg' | 'bg-on-text'>('text-on-bg');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [view, setView] = useState<'cards' | 'matrix'>('cards');

  const selectedColor = colors[selectedIndex];

  const getMatrixCellBgColor = (apcaValue: number) => {
    const absApca = Math.abs(apcaValue);
    if (absApca >= 90) return 'hsl(160, 85%, 35%)';
    if (absApca >= 75) return 'hsl(160, 70%, 45%)';
    if (absApca >= 60) return 'hsl(160, 50%, 55%)';
    if (absApca >= 45) return 'hsl(45, 85%, 50%)';
    if (absApca >= 30) return 'hsl(25, 85%, 50%)';
    if (absApca >= 15) return 'hsl(5, 85%, 50%)';
    return 'hsl(0, 70%, 45%)';
  };

  const getMatrixTextColor = (apcaValue: number) => {
    const absApca = Math.abs(apcaValue);
    return absApca >= 45 ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.85)';
  };

  return (
    <div className="px-[1rem] space-y-[1.5rem]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[1rem]">
          <div className="flex bg-muted rounded-lg p-[0.25rem] gap-[0.25rem]">
            <Button variant={view === 'cards' ? 'secondary' : 'ghost'} size="sm" className="h-[1.75rem] text-[0.75rem] px-[0.75rem]" onClick={() => setView('cards')}>
              Cards
            </Button>
            <Button variant={view === 'matrix' ? 'secondary' : 'ghost'} size="sm" className="h-[1.75rem] text-[0.75rem] px-[0.75rem]" onClick={() => setView('matrix')}>
              Matrix
            </Button>
          </div>

          {view === 'cards' && (
            <>
              <div className="h-[1rem] w-[0.0625rem] bg-border" />
              <div className="flex items-center gap-[0.5rem]">
                <Label className="text-[0.75rem]">Mode:</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[10rem] justify-between px-[0.75rem] text-[0.75rem]">
                      {mode === 'text-on-bg' ? 'Text on Background' : 'Background on Text'}
                      <ChevronDown className="h-[1rem] w-[1rem] opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => { setMode('text-on-bg'); setSelectedIndex(0); }}>Text on Background</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setMode('bg-on-text'); setSelectedIndex(10); }}>Background on Text</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-[0.5rem]">
                <Label className="text-[0.75rem]">{mode === 'text-on-bg' ? 'Background:' : 'Text Color:'}</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[8rem] justify-between gap-[0.5rem] text-[0.75rem]">
                      <div className="flex items-center gap-[0.5rem]">
                        <div className="h-[0.75rem] w-[0.75rem] rounded-full border" style={{ backgroundColor: selectedColor }} />
                        Step {selectedIndex + 1}
                      </div>
                      <ChevronDown className="h-[1rem] w-[1rem] opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-[16rem] overflow-y-auto">
                    {colors.map((c, i) => (
                      <DropdownMenuItem key={i} onClick={() => setSelectedIndex(i)} className="flex items-center gap-[0.5rem]">
                        <div className="h-[0.75rem] w-[0.75rem] rounded-full border" style={{ backgroundColor: c }} />
                        Step {i + 1}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>

        <div className="text-[0.75rem] text-muted-foreground">
          <span className="font-medium">APCA</span>
          {view === 'cards' && <> & <span className="font-medium">WCAG 2.1</span></>}
        </div>
      </div>

      {view === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[1rem]">
          {colors.map((color, i) => {
            if (i === selectedIndex) return null;
            const bg = mode === 'text-on-bg' ? selectedColor : color;
            const fg = mode === 'text-on-bg' ? color : selectedColor;
            const wcag = getContrast(fg, bg);
            const apca = getAPCA(fg, bg);
            const wcagRating = getWCAGRating(wcag);
            const apcaRating = getAPCARating(apca);

            return (
              <div key={i} className="rounded-lg border p-[1rem] flex flex-col gap-[0.75rem] transition-all hover:shadow-md" style={{ backgroundColor: bg }}>
                <div className="flex justify-between items-start">
                  <span className="text-[0.875rem] font-bold" style={{ color: fg }}>Step {i + 1}</span>
                  {wcagRating.label !== 'Fail' && (
                    <div className="h-[1rem] w-[1rem] rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="h-[0.75rem] w-[0.75rem] text-white" />
                    </div>
                  )}
                </div>
                <div style={{ color: fg }} className="text-[1.125rem] font-semibold leading-tight">
                  The quick brown fox
                </div>
                <div className="mt-auto pt-[0.5rem] flex flex-col gap-[0.375rem]">
                  <div className="flex items-center justify-between text-[0.75rem]">
                    <span className="opacity-70 mix-blend-multiply dark:mix-blend-screen" style={{ color: fg }}>WCAG {wcag.toFixed(2)}</span>
                    <span className={`px-[0.375rem] py-[0.125rem] rounded text-[0.625rem] font-medium ${wcagRating.class}`}>{wcagRating.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-[0.75rem]">
                    <span className="opacity-70 mix-blend-multiply dark:mix-blend-screen" style={{ color: fg }}>Lc {Math.round(Math.abs(apca))}</span>
                    <span className={`px-[0.375rem] py-[0.125rem] rounded text-[0.625rem] font-medium ${apcaRating.class}`}>{apcaRating.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="grid gap-0" style={{ gridTemplateColumns: `3.75rem repeat(${colors.length}, minmax(4.375rem, 1fr))` }}>
              <div className="border border-border bg-muted/50 flex items-center justify-center p-[0.5rem]">
                <span className="text-[0.625rem] font-medium text-muted-foreground">Bg / Fg</span>
              </div>
              {colors.map((color, i) => (
                <div key={`header-${i}`} className="border border-border bg-muted/30 flex items-center justify-center p-[0.5rem]">
                  <div className="flex flex-col items-center gap-[0.25rem]">
                    <div className="h-[1rem] w-[1rem] rounded-full border-2 border-background shadow-sm" style={{ backgroundColor: color }} />
                    <span className="text-[0.625rem] font-medium">{i + 1}</span>
                  </div>
                </div>
              ))}
              {colors.map((bgColor, bgIndex) => (
                <div key={`row-${bgIndex}`} style={{ display: 'contents' }}>
                  <div className="border border-border bg-muted/30 flex items-center justify-center p-[0.5rem]">
                    <div className="flex items-center gap-[0.5rem]">
                      <span className="text-[0.625rem] font-medium">{bgIndex + 1}</span>
                      <div className="h-[1rem] w-[1rem] rounded-full border-2 border-background shadow-sm" style={{ backgroundColor: bgColor }} />
                    </div>
                  </div>
                  {colors.map((fgColor, fgIndex) => {
                    if (bgIndex === fgIndex) {
                      return (
                        <div key={`cell-${bgIndex}-${fgIndex}`} className="border border-border flex items-center justify-center p-[0.75rem] bg-muted/80">
                          <span className="text-[1.25rem] text-muted-foreground/30 font-bold">-</span>
                        </div>
                      );
                    }
                    const apca = getAPCA(fgColor, bgColor);
                    const absApca = Math.abs(apca);
                    return (
                      <div
                        key={`cell-${bgIndex}-${fgIndex}`}
                        className="border border-border flex items-center justify-center p-[0.75rem] transition-all hover:scale-105 hover:z-10 hover:shadow-lg cursor-default"
                        style={{ backgroundColor: getMatrixCellBgColor(apca) }}
                        title={`Lc ${absApca.toFixed(1)} (Step ${bgIndex + 1} bg, Step ${fgIndex + 1} fg)`}
                      >
                        <span className="text-[0.75rem] font-bold" style={{ color: getMatrixTextColor(apca) }}>
                          {absApca.toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-[1.5rem] flex flex-wrap items-center gap-[0.75rem] text-[0.75rem]">
              <span className="font-medium text-muted-foreground">Legend:</span>
              {[
                { color: 'hsl(160, 85%, 35%)', label: '90+ (Excellent)' },
                { color: 'hsl(160, 70%, 45%)', label: '75-89 (Great)' },
                { color: 'hsl(160, 50%, 55%)', label: '60-74 (Good)' },
                { color: 'hsl(45, 85%, 50%)', label: '45-59 (Fair)' },
                { color: 'hsl(25, 85%, 50%)', label: '30-44 (Poor)' },
                { color: 'hsl(5, 85%, 50%)', label: '15-29 (Very Poor)' },
                { color: 'hsl(0, 70%, 45%)', label: '<15 (Fail)' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-[0.375rem]">
                  <div className="h-[0.75rem] w-[0.75rem] rounded" style={{ backgroundColor: color }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}