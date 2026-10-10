import { useMemo, useState } from 'react';
import { Check, Copy, Lock, SlidersHorizontal } from 'lucide-react';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../ui/utils';
import {
  AlphaColorScale,
  ColorFormat,
  formatAlphaColor,
  formatScaleColor,
  generateAlphaScale,
  getAPCA,
  getAPCARating,
  getContrast,
  getSurfaceColor,
  getWCAGRating,
} from '../../lib/color-utils';
import { copyToClipboard } from '../../lib/clipboard';
import { CONTRAST_USAGE, GeneratedPalette, STEP_GROUPS, STEP_USAGE, SURFACE_USAGE } from '../../lib/export-utils';

type View = 'scale' | 'alpha' | 'contrast';
type AlphaFormat = 'rgba' | 'hsla' | 'hex8';

// ---------- Helpers ----------

function readableOn(color: string): string {
  const white = Math.abs(getAPCA('#ffffff', color));
  const black = Math.abs(getAPCA('#000000', color));
  return white > black ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.78)';
}

/** Compact swatch label: "RRGGBB", or "L C H" from a wide-gamut oklch() string. */
function shortValue(value: string, format: ColorFormat) {
  if (format === 'oklch') {
    const [l = '0', c = '0', h = '0'] = value.replace(/^oklch\(|\)$/g, '').replace('%', '').split(/\s+/);
    const hue = Number(h);
    return `${Number(l).toFixed(1)} ${Number(c).toFixed(3)} ${Number.isFinite(hue) ? Math.round(hue) : 0}`;
  }
  return value.replace('#', '').toUpperCase();
}

function useCopyFlash() {
  const [copied, setCopied] = useState<number | null>(null);
  const flash = (index: number, value: string) => {
    copyToClipboard(value);
    setCopied(index);
    window.setTimeout(() => setCopied((c) => (c === index ? null : c)), 1200);
  };
  return [copied, flash] as const;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  size?: 'sm' | 'md';
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)} className="gap-0">
      <TabsList className={cn('rounded-lg', size === 'sm' ? 'h-7' : 'h-8')}>
        {options.map((o) => (
          <TabsTrigger
            key={o.value}
            value={o.value}
            className={cn('rounded-md', size === 'sm' ? 'px-2 text-[0.6875rem] font-mono' : 'px-3 text-xs')}
          >
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

// ---------- PaletteDisplay ----------

export function PaletteDisplay({
  palette,
  colorFormat = 'hex',
  active = false,
  onSelect,
  onEdit,
}: {
  palette: GeneratedPalette;
  colorFormat?: ColorFormat;
  active?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
}) {
  const [view, setView] = useState<View>('scale');
  const [alphaFormat, setAlphaFormat] = useState<AlphaFormat>('rgba');

  const alphaScale = useMemo(
    () => generateAlphaScale(palette.scale, palette.isDark),
    [palette.scale, palette.isDark],
  );

  return (
    <article
      id={`palette-${palette.id}`}
      onClick={onSelect}
      className={cn(
        'scroll-mt-6 overflow-hidden rounded-xl border bg-card shadow-card transition-[box-shadow,border-color] duration-200',
        active ? 'border-foreground/25 shadow-card-hover' : 'hover:shadow-card-hover',
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="size-8 shrink-0 rounded-lg shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]"
            style={{ backgroundColor: palette.baseColor }}
          />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h2 className="truncate text-base font-semibold tracking-tight">{palette.name || 'Untitled'}</h2>
              <span className="font-mono text-xs text-muted-foreground uppercase">{palette.baseColor}</span>
            </div>
            {palette.description && (
              <p className="truncate text-xs text-muted-foreground">{palette.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'scale', label: 'Solid' },
              { value: 'alpha', label: 'Alpha' },
              { value: 'contrast', label: 'Contrast' },
            ]}
          />
          {onEdit && (
            <Button variant="outline" size="icon" className="size-8 lg:hidden" onClick={onEdit} aria-label={`Edit ${palette.name}`}>
              <SlidersHorizontal />
            </Button>
          )}
        </div>
      </header>

      {view === 'scale' && <SolidScale palette={palette} colorFormat={colorFormat} />}
      {view === 'alpha' && (
        <AlphaScaleView
          alphaScale={alphaScale}
          solidColors={palette.scale.colors}
          alphaFormat={alphaFormat}
          setAlphaFormat={setAlphaFormat}
        />
      )}
      {view === 'contrast' && <PaletteContrast colors={palette.scale.colors} />}
    </article>
  );
}

// ---------- SolidScale ----------

function SolidScale({ palette, colorFormat }: { palette: GeneratedPalette; colorFormat: ColorFormat }) {
  const [copied, flash] = useCopyFlash();

  return (
    <div className="px-5 pb-5">
      <div className="grid grid-cols-4 gap-1 overflow-hidden rounded-lg sm:grid-cols-6 md:grid-cols-12 md:gap-0">
        {palette.scale.colors.map((color, i) => {
          const fg = i === 8 ? palette.scale.contrast : readableOn(color);
          const value = formatScaleColor(palette.scale, i, colorFormat);
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => flash(i, value)}
                  aria-label={`Copy step ${i + 1}: ${value}`}
                  className="group/swatch relative flex h-14 flex-col justify-between p-2 text-left transition-[filter] hover:brightness-[1.06] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground max-md:rounded-md md:h-28 md:rounded-none"
                  style={{ backgroundColor: color, color: fg }}
                >
                  <span className="flex items-center justify-between font-mono text-[0.6875rem] font-medium opacity-70">
                    {i + 1}
                    {i === 8 && palette.lockStep9 && palette.role !== 'gray' && <Lock className="size-3" aria-label="Locked to base color" />}
                  </span>
                  <span className="font-mono text-[0.625rem] leading-tight tracking-tight tabular md:text-[0.6875rem]">
                    {copied === i ? (
                      <span className="inline-flex items-center gap-1">
                        <Check className="size-3" /> Copied
                      </span>
                    ) : (
                      shortValue(value, colorFormat)
                    )}
                  </span>
                  <Copy className="absolute top-2 right-2 size-3 opacity-0 transition-opacity group-hover/swatch:opacity-60" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[14rem]">
                <div className="font-medium">Step {i + 1}</div>
                <div className="opacity-80">{STEP_USAGE[i]}</div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Step roles */}
      <div className="mt-2 hidden grid-cols-12 gap-0 md:grid">
        {STEP_GROUPS.map((g) => (
          <div key={g.label} style={{ gridColumn: `span ${g.span}` }} className="px-1">
            <div className="h-1 rounded-full border-x border-b border-border" />
            <div className="mt-1 text-center text-[0.6875rem] text-muted-foreground">{g.label}</div>
          </div>
        ))}
      </div>

      <ExtraTokens palette={palette} colorFormat={colorFormat} />
    </div>
  );
}

// ---------- ExtraTokens ----------

function ExtraTokens({ palette, colorFormat }: { palette: GeneratedPalette; colorFormat: ColorFormat }) {
  const [copied, flash] = useCopyFlash();
  const { scale } = palette;
  const surface = getSurfaceColor(scale);
  const items = [
    {
      label: 'Contrast',
      usage: CONTRAST_USAGE,
      value: scale.contrast,
      swatch: (
        <span
          className="flex size-5 items-center justify-center rounded text-[0.625rem] font-semibold"
          style={{ backgroundColor: scale.colors[8], color: scale.contrast }}
        >
          Aa
        </span>
      ),
    },
    {
      label: 'Surface',
      usage: SURFACE_USAGE,
      value: colorFormat === 'oklch' ? scale.surfaceWideGamut : surface.hex8,
      swatch: (
        <span className="size-5 overflow-hidden rounded border" style={{ backgroundColor: scale.background }}>
          <span className="block size-full" style={{ backgroundColor: surface.rgba }} />
        </span>
      ),
    },
  ];

  return (
    <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
      {items.map((item, i) => (
        <Tooltip key={item.label}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => flash(i, item.value)}
              aria-label={`Copy ${item.label.toLowerCase()}: ${item.value}`}
              className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              {item.swatch}
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono text-[0.6875rem] tabular">
                {copied === i ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="size-3" /> Copied
                  </span>
                ) : (
                  item.value
                )}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{item.usage}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

// ---------- AlphaScaleView ----------

function alphaBadgeClass(alpha: number) {
  if (alpha <= 0.1) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (alpha <= 0.3) return 'bg-sky-500/10 text-sky-700 dark:text-sky-300';
  if (alpha <= 0.6) return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'bg-rose-500/10 text-rose-700 dark:text-rose-300';
}

function AlphaScaleView({
  alphaScale,
  solidColors,
  alphaFormat,
  setAlphaFormat,
}: {
  alphaScale: AlphaColorScale;
  solidColors: string[];
  alphaFormat: AlphaFormat;
  setAlphaFormat: (f: AlphaFormat) => void;
}) {
  const [copied, flash] = useCopyFlash();

  return (
    <div className="px-5 pb-5" onClick={(e) => e.stopPropagation()}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm border" style={{ backgroundColor: alphaScale.background }} />
          Composited over <span className="font-mono text-foreground">{alphaScale.background}</span>
        </span>
        <Segmented
          size="sm"
          value={alphaFormat}
          onChange={setAlphaFormat}
          options={[
            { value: 'rgba', label: 'RGBA' },
            { value: 'hsla', label: 'HSLA' },
            { value: 'hex8', label: 'HEX8' },
          ]}
        />
      </div>

      <div className="checkerboard grid grid-cols-4 gap-1 overflow-hidden rounded-lg sm:grid-cols-6 md:grid-cols-12 md:gap-0">
        {alphaScale.colors.map((alpha, i) => {
          const value = formatAlphaColor(alpha, alphaFormat);
          return (
            <button
              key={i}
              type="button"
              title={value}
              onClick={() => flash(i, value)}
              className="flex h-16 flex-col justify-between p-2 text-left transition-[filter] hover:brightness-[1.06] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground max-md:rounded-md md:h-24"
              style={{ backgroundColor: alpha.rgba, color: readableOn(solidColors[i]) }}
            >
              <span className="font-mono text-[0.6875rem] font-medium opacity-70">{i + 1}A</span>
              <span className="font-mono text-[0.6875rem] tabular">
                {copied === i ? <Check className="size-3" /> : `${Math.round(alpha.alpha * 100)}%`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Solid vs alpha check */}
      <div className="mt-3 grid grid-cols-12 overflow-hidden rounded-md border">
        {solidColors.map((solid, i) => (
          <div key={i} className="flex flex-col">
            <div className="h-3" style={{ backgroundColor: solid }} />
            <div className="h-3" style={{ backgroundColor: alphaScale.background }}>
              <div className="h-full" style={{ backgroundColor: alphaScale.colors[i].rgba }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">
        Top: solid · Bottom: alpha composited — the rows should match.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Step</th>
              <th className="px-3 py-2 font-medium">Alpha value</th>
              <th className="px-3 py-2 font-medium">Opacity</th>
              <th className="px-3 py-2 font-medium">Solid</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {alphaScale.colors.map((alpha, i) => {
              const value = formatAlphaColor(alpha, alphaFormat);
              return (
                <tr key={i} className="group transition-colors hover:bg-muted/40">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="checkerboard size-4 overflow-hidden rounded border">
                        <span className="block size-full" style={{ backgroundColor: alpha.rgba }} />
                      </span>
                      <span className="font-mono font-medium">{i + 1}A</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 font-mono whitespace-nowrap">{value}</td>
                  <td className="px-3 py-1.5">
                    <span className={cn('rounded px-1.5 py-0.5 font-mono text-[0.6875rem] tabular', alphaBadgeClass(alpha.alpha))}>
                      {Math.round(alpha.alpha * 100)}%
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="flex items-center gap-1.5 font-mono text-muted-foreground uppercase">
                      <span className="size-3 rounded-sm border" style={{ backgroundColor: solidColors[i] }} />
                      {solidColors[i]}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Copy ${i + 1}A`}
                      onClick={() => flash(i, value)}
                    >
                      {copied === i ? <Check className="size-3" /> : <Copy className="size-3" />}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- PaletteContrast ----------

const APCA_BANDS = [
  { min: 90, color: 'hsl(160, 85%, 35%)', label: '90+ Excellent' },
  { min: 75, color: 'hsl(160, 70%, 45%)', label: '75 Great' },
  { min: 60, color: 'hsl(160, 50%, 55%)', label: '60 Good' },
  { min: 45, color: 'hsl(45, 85%, 50%)', label: '45 Fair' },
  { min: 30, color: 'hsl(25, 85%, 50%)', label: '30 Poor' },
  { min: 15, color: 'hsl(5, 85%, 50%)', label: '15 Very poor' },
  { min: 0, color: 'hsl(0, 70%, 45%)', label: '<15 Fail' },
];

const bandFor = (apca: number) => APCA_BANDS.find((b) => Math.abs(apca) >= b.min)!;

function PaletteContrast({ colors }: { colors: string[] }) {
  const [mode, setMode] = useState<'text-on-bg' | 'bg-on-text'>('text-on-bg');
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState<'cards' | 'matrix'>('cards');
  const selectedColor = colors[selected];

  return (
    <div className="space-y-4 px-5 pb-5" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'cards', label: 'Pairs' },
              { value: 'matrix', label: 'Matrix' },
            ]}
          />
          {view === 'cards' && (
            <Segmented
              value={mode}
              onChange={(m) => {
                setMode(m);
                setSelected(m === 'text-on-bg' ? 0 : 10);
              }}
              options={[
                { value: 'text-on-bg', label: 'Text on step' },
                { value: 'bg-on-text', label: 'Step as text' },
              ]}
            />
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          APCA Lc{view === 'cards' && ' · WCAG 2.1'}
        </span>
      </div>

      {view === 'cards' ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {mode === 'text-on-bg' ? 'Background' : 'Text color'}
            </span>
            <div role="radiogroup" className="flex gap-1">
              {colors.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={i === selected}
                  aria-label={`Step ${i + 1}`}
                  onClick={() => setSelected(i)}
                  className={cn(
                    'size-6 rounded-md text-[0.625rem] font-mono font-medium ring-offset-2 ring-offset-card transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    i === selected && 'ring-2 ring-foreground',
                  )}
                  style={{ backgroundColor: c, color: readableOn(c) }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {colors.map((color, i) => {
              if (i === selected) return null;
              const bg = mode === 'text-on-bg' ? selectedColor : color;
              const fg = mode === 'text-on-bg' ? color : selectedColor;
              const wcag = getContrast(fg, bg);
              const apca = getAPCA(fg, bg);
              const wcagRating = getWCAGRating(wcag);
              const apcaRating = getAPCARating(apca);
              const pass = wcagRating.label !== 'Fail';

              return (
                <div key={i} className="flex flex-col gap-3 rounded-lg border p-4" style={{ backgroundColor: bg }}>
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-xs font-medium" style={{ color: fg }}>
                      Step {i + 1}
                    </span>
                    {pass && (
                      <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500">
                        <Check className="size-3 text-white" />
                      </span>
                    )}
                  </div>
                  <div className="text-lg leading-tight font-semibold" style={{ color: fg }}>
                    The quick brown fox
                  </div>
                  <div className="mt-auto flex flex-col gap-1.5 rounded-md bg-card/90 p-2 text-xs backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono tabular text-muted-foreground">WCAG {wcag.toFixed(2)}</span>
                      <span className={cn('rounded px-1.5 py-0.5 text-[0.625rem] font-medium', wcagRating.class)}>
                        {wcagRating.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono tabular text-muted-foreground">Lc {Math.round(Math.abs(apca))}</span>
                      <span className={cn('rounded px-1.5 py-0.5 text-[0.625rem] font-medium', apcaRating.class)}>
                        {apcaRating.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <div
              className="grid min-w-[44rem]"
              style={{ gridTemplateColumns: `3rem repeat(${colors.length}, minmax(0, 1fr))` }}
            >
              <div className="flex items-center justify-center border-r border-b bg-muted/50 p-1.5 text-[0.625rem] text-muted-foreground">
                bg\fg
              </div>
              {colors.map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1 border-b bg-muted/50 py-1.5">
                  <span className="size-3 rounded-full border" style={{ backgroundColor: c }} />
                  <span className="font-mono text-[0.625rem]">{i + 1}</span>
                </div>
              ))}
              {colors.map((bg, bi) => (
                <div key={bi} className="contents">
                  <div className="flex items-center justify-center gap-1 border-r bg-muted/50">
                    <span className="font-mono text-[0.625rem]">{bi + 1}</span>
                    <span className="size-3 rounded-full border" style={{ backgroundColor: bg }} />
                  </div>
                  {colors.map((fg, fi) => {
                    if (bi === fi) return <div key={fi} className="bg-muted" />;
                    const apca = getAPCA(fg, bg);
                    const band = bandFor(apca);
                    return (
                      <div
                        key={fi}
                        title={`Lc ${Math.abs(apca).toFixed(1)} — step ${fi + 1} text on step ${bi + 1}`}
                        className="flex items-center justify-center py-2.5 font-mono text-[0.6875rem] font-medium tabular"
                        style={{
                          backgroundColor: band.color,
                          color: Math.abs(apca) >= 45 ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.8)',
                        }}
                      >
                        {Math.round(Math.abs(apca))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {APCA_BANDS.map((b) => (
              <span key={b.label} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
                {b.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
