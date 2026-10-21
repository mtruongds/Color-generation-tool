import { useMemo, useState } from 'react';
import { Slider } from '../ui/slider';
import { cn } from '../ui/utils';
import {
  type Accent,
  type Breakpoint,
  DEFAULT_FOUNDATIONS,
  GRID_PRESETS,
  type GridConfig,
  computeGridLayout,
  sortedBreakpoints,
} from '../../lib/foundations';
import { CanvasHeading, NumberInput, Section, SelectField, SliderField } from './inspector-controls';

const DEFAULTS = DEFAULT_FOUNDATIONS.grid;
const MIN_VIEWPORT = 320;
const MAX_VIEWPORT = 1920;

/** A sensible width to preview each breakpoint at. */
const previewWidth = (b: Breakpoint) => (b.minWidth === 0 ? 375 : b.minWidth);

export function GridCanvas({ config, accent }: { config: GridConfig; accent: Accent }) {
  const [viewport, setViewport] = useState(1280);
  const layout = useMemo(() => computeGridLayout(config, viewport), [config, viewport]);
  const breakpoints = sortedBreakpoints(config);
  const { breakpoint: bp } = layout;
  const pct = (px: number) => `${(px / viewport) * 100}%`;

  return (
    <div className="space-y-8">
      <div>
        <CanvasHeading title="Preview">
          <span className="font-mono tabular">{viewport}px</span> · {bp.name}
        </CanvasHeading>

        <div className="rounded-2xl border bg-card p-4 shadow-card sm:p-6">
          {/* Breakpoint chips */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {breakpoints.map((b) => (
              <button
                key={b.name}
                type="button"
                onClick={() => setViewport(previewWidth(b))}
                aria-pressed={b.name === bp.name}
                className={cn(
                  'rounded-full border px-2.5 py-1 font-mono text-[0.6875rem] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  b.name === bp.name && 'border-foreground/40 bg-accent text-foreground',
                  b.name !== bp.name && 'text-muted-foreground',
                )}
              >
                {b.name} <span className="opacity-60">≥{b.minWidth}</span>
              </button>
            ))}
          </div>

          {/* Frame — everything is positioned as a share of the simulated viewport */}
          <div className="relative h-64 overflow-hidden rounded-lg border bg-background sm:h-72">
            {layout.sidebar > 0 && (
              <div className="absolute inset-y-0 left-0 border-r bg-muted/60" style={{ width: pct(layout.sidebar) }}>
                <span className="absolute top-2 left-2 font-mono text-[0.625rem] text-muted-foreground">sidebar</span>
              </div>
            )}
            {/* Margins */}
            {[layout.offset - bp.margin, layout.offset + layout.content].map((left, i) => (
              <div
                key={i}
                className="absolute inset-y-0"
                style={{
                  left: pct(left),
                  width: pct(bp.margin),
                  background: 'repeating-linear-gradient(-45deg, transparent 0 4px, color-mix(in oklab, var(--foreground) 7%, transparent) 4px 5px)',
                }}
              />
            ))}
            {/* Columns */}
            {Array.from({ length: bp.columns }, (_, i) => (
              <div
                key={i}
                className="absolute inset-y-0 flex items-end justify-center pb-2"
                style={{
                  left: pct(layout.offset + i * (layout.column + bp.gutter)),
                  width: pct(layout.column),
                  background: `color-mix(in oklab, ${accent.solid} 16%, transparent)`,
                  borderInline: `1px solid color-mix(in oklab, ${accent.solid} 30%, transparent)`,
                }}
              >
                <span className="font-mono text-[0.625rem] tabular" style={{ color: accent.text }}>
                  {i + 1}
                </span>
              </div>
            ))}
            {/* Content cap */}
            {config.maxWidth > 0 && layout.content >= config.maxWidth && (
              <div
                className="absolute top-0 border-x border-dashed border-foreground/40"
                style={{ left: pct(layout.offset), width: pct(layout.content), height: 18 }}
              >
                <span className="absolute inset-x-0 top-0.5 text-center font-mono text-[0.625rem] text-muted-foreground">
                  max {config.maxWidth}px
                </span>
              </div>
            )}
          </div>

          <div className="mt-4">
            <Slider
              aria-label="Viewport width"
              min={MIN_VIEWPORT}
              max={MAX_VIEWPORT}
              step={1}
              value={[viewport]}
              onValueChange={(v) => setViewport(v[0])}
            />
            <div className="mt-1.5 flex justify-between font-mono text-[0.625rem] text-muted-foreground tabular">
              <span>{MIN_VIEWPORT}</span>
              <span>Viewport width</span>
              <span>{MAX_VIEWPORT}</span>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-5">
            {[
              ['Columns', bp.columns],
              ['Column', `${layout.column.toFixed(1)}px`],
              ['Gutter', `${bp.gutter}px`],
              ['Margin', `${bp.margin}px`],
              ['Content', `${Math.round(layout.content)}px`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[0.6875rem] text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 font-mono text-sm tabular">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div>
        <CanvasHeading title="Breakpoints" />
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
          <table className="w-full min-w-[30rem] text-left text-xs tabular">
            <thead className="border-b text-muted-foreground">
              <tr>
                {['Name', 'Min width', 'Columns', 'Gutter', 'Margin'].map((h) => (
                  <th key={h} className="px-5 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y font-mono">
              {breakpoints.map((b) => (
                <tr
                  key={b.name}
                  onClick={() => setViewport(previewWidth(b))}
                  className={cn('cursor-pointer transition-colors hover:bg-accent/40', b.name === bp.name && 'bg-accent/60')}
                >
                  <td className="px-5 py-2.5 font-medium">{b.name}</td>
                  <td className="px-5 py-2.5">{b.minWidth}px</td>
                  <td className="px-5 py-2.5">{b.columns}</td>
                  <td className="px-5 py-2.5">{b.gutter}px</td>
                  <td className="px-5 py-2.5">{b.margin}px</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function GridInspector({
  config,
  spacingBase,
  onChange,
}: {
  config: GridConfig;
  /** Gutters and margins that aren't a multiple of this get flagged. */
  spacingBase: number;
  onChange: (updates: Partial<GridConfig>) => void;
}) {
  const breakpoints = sortedBreakpoints(config);
  const preset = GRID_PRESETS.find(
    (p) => JSON.stringify(p.breakpoints) === JSON.stringify(breakpoints) && p.maxWidth === config.maxWidth,
  );

  const updateBreakpoint = (name: string, updates: Partial<Breakpoint>) =>
    onChange({ breakpoints: config.breakpoints.map((b) => (b.name === name ? { ...b, ...updates } : b)) });

  const offGrid = breakpoints.filter((b) => b.gutter % spacingBase !== 0 || b.margin % spacingBase !== 0);

  return (
    <div className="flex flex-col">
      <Section title="Preset">
        <SelectField
          label="Start from"
          value={preset?.label ?? 'custom'}
          options={[
            ...GRID_PRESETS.map((p) => ({ value: p.label, label: p.label })),
            ...(preset ? [] : [{ value: 'custom', label: 'Custom' }]),
          ]}
          onChange={(label) => {
            const next = GRID_PRESETS.find((p) => p.label === label);
            if (!next) return;
            const keepsSidebarFrom = next.breakpoints.some((b) => b.name === config.sidebarFrom);
            onChange({
              breakpoints: next.breakpoints,
              maxWidth: next.maxWidth,
              sidebarFrom: keepsSidebarFrom ? config.sidebarFrom : next.breakpoints[3].name,
            });
          }}
        />
        {preset && <p className="text-xs leading-snug text-muted-foreground">{preset.hint}.</p>}
      </Section>

      <Section title="Container">
        <SliderField
          label="Max width"
          value={config.maxWidth}
          display={config.maxWidth === 0 ? 'fluid' : `${config.maxWidth}px`}
          min={0}
          max={1920}
          step={8}
          defaultValue={DEFAULTS.maxWidth}
          onChange={(maxWidth) => onChange({ maxWidth })}
        />
        <SliderField
          label="Sidebar"
          value={config.sidebar}
          display={config.sidebar === 0 ? 'none' : `${config.sidebar}px`}
          min={0}
          max={400}
          step={8}
          defaultValue={DEFAULTS.sidebar}
          onChange={(sidebar) => onChange({ sidebar })}
        />
        {config.sidebar > 0 && (
          <SelectField
            label="Sidebar from"
            value={config.sidebarFrom}
            options={breakpoints.map((b) => ({ value: b.name, label: `${b.name} · ${b.minWidth}px` }))}
            onChange={(sidebarFrom) => onChange({ sidebarFrom })}
          />
        )}
        <p className="text-xs leading-snug text-muted-foreground">
          The sidebar and margins come off first, then the cap, then the rest is split into columns.
        </p>
      </Section>

      <Section title="Breakpoints">
        <div className="grid grid-cols-[2.25rem_repeat(4,minmax(0,1fr))] items-center gap-x-1.5 gap-y-1.5">
          {['', 'Min', 'Cols', 'Gutter', 'Margin'].map((h) => (
            <span key={h} className="text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
              {h}
            </span>
          ))}
          {breakpoints.map((b) => (
            <BreakpointRow key={b.name} breakpoint={b} isFirst={b.minWidth === 0} onChange={(u) => updateBreakpoint(b.name, u)} />
          ))}
        </div>
        {offGrid.length > 0 && (
          <p className="text-xs leading-snug text-amber-700 dark:text-amber-400">
            {offGrid.map((b) => b.name).join(', ')} {offGrid.length === 1 ? 'has' : 'have'} gutters or margins that
            aren’t a multiple of the {spacingBase}px spacing unit.
          </p>
        )}
      </Section>
    </div>
  );
}

function BreakpointRow({
  breakpoint: b,
  isFirst,
  onChange,
}: {
  breakpoint: Breakpoint;
  isFirst: boolean;
  onChange: (updates: Partial<Breakpoint>) => void;
}) {
  return (
    <>
      <span className="font-mono text-xs font-medium">{b.name}</span>
      {isFirst ? (
        <span className="px-2 text-right font-mono text-xs text-muted-foreground">0</span>
      ) : (
        <NumberInput aria-label={`${b.name} min width`} value={b.minWidth} min={1} max={3840} onChange={(minWidth) => onChange({ minWidth })} />
      )}
      <NumberInput aria-label={`${b.name} columns`} value={b.columns} min={1} max={24} onChange={(columns) => onChange({ columns })} />
      <NumberInput aria-label={`${b.name} gutter`} value={b.gutter} min={0} max={96} onChange={(gutter) => onChange({ gutter })} />
      <NumberInput aria-label={`${b.name} margin`} value={b.margin} min={0} max={160} onChange={(margin) => onChange({ margin })} />
    </>
  );
}
