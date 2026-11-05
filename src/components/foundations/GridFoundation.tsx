import { useMemo, useRef, useState } from 'react';
import { Slider } from '../ui/slider';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
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
import { CanvasHeading, NumberInput, Section, SelectField, SliderField, SwitchField } from './inspector-controls';

const DEFAULTS = DEFAULT_FOUNDATIONS.grid;
const MIN_VIEWPORT = 320;
const MAX_VIEWPORT = 1920;

/** A sensible width to preview each breakpoint at. */
const previewWidth = (b: Breakpoint) => (b.minWidth === 0 ? 375 : b.minWidth);

type PreviewView = 'columns' | 'dashboard' | 'website';

const VIEWS: { value: PreviewView; label: string }[] = [
  { value: 'columns', label: 'Columns' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'website', label: 'Website' },
];

const DEVICES = [
  { label: 'Mobile', width: 375 },
  { label: 'Tablet', width: 768 },
  { label: 'Desktop', width: 1440 },
];

/** Below this content width the mockups switch to their stacked, single-column arrangement. */
const NARROW_CONTENT = 600;

type BlockKind = 'title' | 'nav' | 'kpi' | 'chart' | 'list' | 'table' | 'hero' | 'image' | 'card' | 'band' | 'footer';

/** Span is given on a 12-column grid as [wide, narrow] and rescaled to the breakpoint's column count. */
interface Block {
  kind: BlockKind;
  span: [number, number];
  height: number;
}

const kpis = (n: number): Block[] => Array.from({ length: n }, () => ({ kind: 'kpi', span: [3, 6], height: 44 }));
const cards = (n: number): Block[] => Array.from({ length: n }, () => ({ kind: 'card', span: [4, 12], height: 72 }));
const footerCols = (n: number): Block[] => Array.from({ length: n }, () => ({ kind: 'footer', span: [3, 6], height: 36 }));

const MOCKUPS: Record<Exclude<PreviewView, 'columns'>, Block[]> = {
  dashboard: [
    { kind: 'title', span: [12, 12], height: 20 },
    ...kpis(4),
    { kind: 'chart', span: [8, 12], height: 96 },
    { kind: 'list', span: [4, 12], height: 96 },
    { kind: 'table', span: [12, 12], height: 88 },
  ],
  website: [
    { kind: 'nav', span: [12, 12], height: 22 },
    { kind: 'hero', span: [6, 12], height: 96 },
    { kind: 'image', span: [6, 12], height: 96 },
    ...cards(3),
    { kind: 'band', span: [12, 12], height: 40 },
    ...footerCols(4),
  ],
};

const Line = ({ w, strong }: { w: string; strong?: boolean }) => (
  <div className={cn('h-1.5 rounded-full', strong ? 'bg-foreground/25' : 'bg-foreground/10')} style={{ width: w }} />
);

function MockBlock({ kind, accent }: { kind: BlockKind; accent: Accent }) {
  const tint = (pct: number) => `color-mix(in oklab, ${accent.solid} ${pct}%, transparent)`;
  const box = 'h-full overflow-hidden rounded-md border bg-card p-2';

  switch (kind) {
    case 'title':
      return (
        <div className="flex h-full items-center justify-between">
          <Line w="30%" strong />
          <div className="h-full w-12 rounded" style={{ background: accent.solid }} />
        </div>
      );
    case 'nav':
      return (
        <div className="flex h-full items-center gap-2 border-b pb-1">
          <div className="size-3 rounded-sm" style={{ background: accent.solid }} />
          <div className="flex-1" />
          <Line w="8%" />
          <Line w="8%" />
          <Line w="8%" />
          <div className="h-full w-10 rounded" style={{ background: tint(30) }} />
        </div>
      );
    case 'kpi':
      return (
        <div className={cn(box, 'flex flex-col justify-between')}>
          <Line w="50%" />
          <div className="h-2.5 w-2/3 rounded-full bg-foreground/25" />
        </div>
      );
    case 'chart':
      return (
        <div className={cn(box, 'flex flex-col gap-2')}>
          <Line w="25%" strong />
          <div className="flex flex-1 items-end gap-[6%]">
            {[40, 65, 50, 80, 60, 90, 70, 55].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: tint(i === 5 ? 80 : 35) }} />
            ))}
          </div>
        </div>
      );
    case 'list':
      return (
        <div className={cn(box, 'flex flex-col gap-2')}>
          <Line w="40%" strong />
          {[70, 55, 80, 45].map((w, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="size-2 shrink-0 rounded-full bg-foreground/15" />
              <Line w={`${w}%`} />
            </div>
          ))}
        </div>
      );
    case 'table':
      return (
        <div className={cn(box, 'flex flex-col gap-2 p-0')}>
          <div className="flex gap-[8%] border-b px-2 py-1.5">
            {[20, 15, 15, 10].map((w, i) => (
              <Line key={i} w={`${w}%`} strong />
            ))}
          </div>
          {[0, 1, 2].map((r) => (
            <div key={r} className="flex gap-[8%] px-2">
              {[20, 15, 15, 10].map((w, i) => (
                <Line key={i} w={`${w}%`} />
              ))}
            </div>
          ))}
        </div>
      );
    case 'hero':
      return (
        <div className="flex h-full flex-col justify-center gap-2">
          <div className="h-3 w-11/12 rounded-full bg-foreground/30" />
          <div className="h-3 w-2/3 rounded-full bg-foreground/30" />
          <Line w="80%" />
          <Line w="60%" />
          <div className="mt-1 h-4 w-16 rounded" style={{ background: accent.solid }} />
        </div>
      );
    case 'image':
      return <div className="h-full rounded-md" style={{ background: tint(22) }} />;
    case 'card':
      return (
        <div className={cn(box, 'flex flex-col gap-1.5')}>
          <div className="mb-1 size-4 rounded" style={{ background: tint(35) }} />
          <Line w="60%" strong />
          <Line w="90%" />
          <Line w="75%" />
        </div>
      );
    case 'band':
      return (
        <div className="flex h-full items-center justify-center gap-3 rounded-md" style={{ background: tint(12) }}>
          <Line w="30%" strong />
          <div className="h-4 w-14 rounded" style={{ background: accent.solid }} />
        </div>
      );
    case 'footer':
      return (
        <div className="flex h-full flex-col gap-1.5 pt-1">
          <Line w="40%" strong />
          <Line w="60%" />
          <Line w="50%" />
        </div>
      );
  }
}

export function GridCanvas({ config, accent }: { config: GridConfig; accent: Accent }) {
  const [viewport, setViewport] = useState(1280);
  const [view, setView] = useState<PreviewView>('columns');
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as PreviewView)} className="gap-0">
              <TabsList className="h-8 rounded-lg" aria-label="Preview layout">
                {VIEWS.map((v) => (
                  <TabsTrigger key={v.value} value={v.value} className="rounded-md px-2.5 text-xs">
                    {v.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex gap-1" role="group" aria-label="Device width">
              {DEVICES.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setViewport(d.width)}
                  aria-pressed={viewport === d.width}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    viewport === d.width ? 'border-foreground/40 bg-accent text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {d.label} <span className="font-mono text-[0.625rem] opacity-60 tabular">{d.width}</span>
                </button>
              ))}
            </div>
          </div>

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

          {/* Frame — everything is positioned as a share of the simulated viewport. It never renders wider than the
              viewport it simulates, so narrow devices show at true size. */}
          <div
            className={cn(
              'relative mx-auto overflow-hidden rounded-lg border bg-background transition-[max-width] duration-300',
              view === 'columns' ? 'h-64 sm:h-72' : 'h-[26rem]',
            )}
            style={{ maxWidth: viewport }}
          >
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
                className={cn('absolute inset-y-0 flex items-end justify-center pb-2', view !== 'columns' && 'opacity-40')}
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
            {/* Mockup — a real CSS grid laid over the column area; percentage gaps resolve against its width */}
            {view !== 'columns' && (
              <Mockup view={view} layout={layout} accent={accent} pct={pct} />
            )}
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

  // Remember the width so turning the sidebar off and on again doesn't lose it
  const lastSidebar = useRef(config.sidebar || DEFAULTS.sidebar);
  if (config.sidebar > 0) lastSidebar.current = config.sidebar;

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
              sidebarFrom: next.sidebarFrom ?? (keepsSidebarFrom ? config.sidebarFrom : next.breakpoints[3].name),
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
        <SwitchField
          label="Sidebar"
          checked={config.sidebar > 0}
          onChange={(on) => onChange({ sidebar: on ? lastSidebar.current : 0 })}
        />
        {config.sidebar > 0 && (
          <SliderField
            label="Sidebar width"
            value={config.sidebar}
            display={`${config.sidebar}px`}
            min={120}
            max={400}
            step={8}
            defaultValue={DEFAULTS.sidebar}
            onChange={(sidebar) => onChange({ sidebar })}
          />
        )}
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

function Mockup({
  view,
  layout,
  accent,
  pct,
}: {
  view: Exclude<PreviewView, 'columns'>;
  layout: ReturnType<typeof computeGridLayout>;
  accent: Accent;
  pct: (px: number) => string;
}) {
  const { breakpoint: bp, content, offset, sidebar } = layout;
  const narrow = content < NARROW_CONTENT;
  const span = ([wide, small]: [number, number]) =>
    Math.min(bp.columns, Math.max(1, Math.round(((narrow ? small : wide) / 12) * bp.columns)));

  return (
    <>
      {sidebar > 0 && (
        <div className="absolute inset-y-0 left-0 flex flex-col gap-2 overflow-hidden p-2 pt-7" style={{ width: pct(sidebar) }}>
          {[60, 75, 50, 70, 55].map((w, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="size-2 shrink-0 rounded-sm" style={{ background: i === 0 ? accent.solid : 'var(--border)' }} />
              <Line w={`${w}%`} strong={i === 0} />
            </div>
          ))}
        </div>
      )}
      <div
        className="absolute top-6 bottom-0 grid content-start gap-y-2 overflow-hidden"
        style={{
          left: pct(offset),
          width: pct(content),
          gridTemplateColumns: `repeat(${bp.columns}, minmax(0, 1fr))`,
          columnGap: content > 0 ? `${(bp.gutter / content) * 100}%` : 0,
        }}
      >
        {MOCKUPS[view].map((b, i) => (
          <div key={i} style={{ gridColumn: `span ${span(b.span)}`, height: b.height }}>
            <MockBlock kind={b.kind} accent={accent} />
          </div>
        ))}
      </div>
    </>
  );
}
