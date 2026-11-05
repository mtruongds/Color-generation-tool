import { useMemo } from 'react';
import { copyToClipboard } from '../../lib/clipboard';
import { cn } from '../ui/utils';
import { type Accent, DEFAULT_FOUNDATIONS, RADIUS_FULL, RADIUS_PRESETS, type RadiusConfig, generateRadiusScale, nestedRadius } from '../../lib/foundations';
import { CanvasHeading, Section, SliderField, SwitchField } from './inspector-controls';

const DEFAULTS = DEFAULT_FOUNDATIONS.radius;

export function RadiusCanvas({ config, accent }: { config: RadiusConfig; accent: Accent }) {
  const scale = useMemo(() => generateRadiusScale(config), [config]);
  const r = Object.fromEntries(scale.map((t) => [t.name, t.value]));
  const cardPadding = 12;

  return (
    <div className="space-y-8">
      <div>
        <CanvasHeading title="Scale">md = {config.base}px</CanvasHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {scale.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => copyToClipboard(`radius-${t.name}`, 'Token')}
              className="group rounded-2xl border bg-card p-4 text-left shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex aspect-[4/3] items-end justify-start">
                <div
                  className="size-[72%] border-t-2 border-l-2"
                  style={{ borderTopLeftRadius: Math.min(t.value, 999), borderColor: accent.solid, background: `color-mix(in oklab, ${accent.solid} 10%, transparent)` }}
                />
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs font-medium">radius-{t.name}</span>
                <span className="font-mono text-[0.6875rem] text-muted-foreground tabular">
                  {t.value === RADIUS_FULL ? 'full' : `${t.value}px`}
                </span>
              </div>
              <div className="mt-1 truncate text-[0.6875rem] text-muted-foreground">{t.usage}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <CanvasHeading title="On components" />
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-6 shadow-card">
          <span className="border px-2 py-0.5 text-xs" style={{ borderRadius: r.sm }}>
            Badge
          </span>
          <span className="size-4 border-2" style={{ borderRadius: r.xs, borderColor: accent.solid, background: accent.solid }} />
          <button type="button" tabIndex={-1} className="px-4 py-2 text-sm font-medium" style={{ borderRadius: r.md, background: accent.solid, color: accent.contrast }}>
            Button
          </button>
          <span className="w-44 border bg-background px-3 py-2 text-sm text-muted-foreground" style={{ borderRadius: r.md }}>
            Input
          </span>
          <span className="px-3 py-1 text-xs font-medium" style={{ borderRadius: r.full, background: accent.subtle, color: accent.text }}>
            Pill
          </span>
          <span className="size-9 bg-muted" style={{ borderRadius: r.full }} />
        </div>
      </div>

      <div>
        <CanvasHeading title="Nested corners">Inner radius = outer radius − padding</CanvasHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: 'Matched', inner: nestedRadius(r.xl, cardPadding), ok: true },
            { label: 'Same radius inside', inner: r.xl, ok: false },
          ].map((v) => (
            <div key={v.label} className="rounded-2xl border bg-card p-6 shadow-card">
              <div className="border bg-muted/50" style={{ borderRadius: r.xl, padding: cardPadding }}>
                <div className="h-20 bg-card shadow-sm" style={{ borderRadius: v.inner }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className={cn('font-medium', !v.ok && 'text-muted-foreground')}>{v.label}</span>
                <span className="font-mono text-muted-foreground tabular">
                  {r.xl}px → {v.inner}px
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** An extra product's own radius. Picked in the header; undefined inherits the first product's. */
export interface RadiusProduct {
  name: string;
  /** The first product, which it inherits from. */
  from: string;
  base: number | undefined;
  onChange: (base: number | undefined) => void;
}

export function RadiusInspector({
  config,
  onChange,
  product,
}: {
  config: RadiusConfig;
  onChange: (updates: Partial<RadiusConfig>) => void;
  product?: RadiusProduct;
}) {
  // An extra product edits its own base; changing it while inheriting gives the product its own
  const base = product?.base ?? config.base;
  const setBase = (value: number) => (product ? product.onChange(value) : onChange({ base: value }));

  return (
    <div className="flex flex-col">
      {product && (
        <Section title="Product">
          <SwitchField
            label={`Own radius for ${product.name}`}
            hint={product.base === undefined ? `Uses ${product.from}'s ${config.base}px.` : `${product.from} uses ${config.base}px.`}
            checked={product.base !== undefined}
            onChange={(on) => product.onChange(on ? config.base : undefined)}
          />
        </Section>
      )}
      <Section title="Presets">
        <div className="grid grid-cols-4 gap-1.5">
          {RADIUS_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              aria-pressed={base === p.base}
              onClick={() => setBase(p.base)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border px-1 py-2.5 text-[0.6875rem] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                base === p.base && 'border-foreground/40 bg-accent',
              )}
            >
              <span className="size-6 border-t-2 border-l-2 border-foreground/70" style={{ borderTopLeftRadius: p.base * 1.5 }} />
              {p.label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Base radius">
        <SliderField
          label="md"
          value={base}
          display={`${base}px`}
          min={0}
          max={24}
          step={1}
          defaultValue={DEFAULTS.base}
          onChange={setBase}
        />
        <p className="text-xs leading-snug text-muted-foreground">
          Buttons and inputs use md. Smaller and larger steps scale from it, so the whole set keeps one character.
        </p>
      </Section>
    </div>
  );
}
