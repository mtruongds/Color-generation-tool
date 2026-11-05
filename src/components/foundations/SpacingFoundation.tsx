import { useMemo } from 'react';
import { copyToClipboard } from '../../lib/clipboard';
import { type Accent, DEFAULT_FOUNDATIONS, type SpacingConfig, generateSpacingScale, spacingTokenName } from '../../lib/foundations';
import { CanvasHeading, Section, SegmentedField, SliderField } from './inspector-controls';

const DEFAULTS = DEFAULT_FOUNDATIONS.spacing;

export function SpacingCanvas({ config, accent }: { config: SpacingConfig; accent: Accent }) {
  const scale = useMemo(() => generateSpacingScale(config), [config]);
  const max = scale.at(-1)?.value ?? 1;
  const s = (m: number) => m * config.base;

  return (
    <div className="space-y-8">
      <div>
        <CanvasHeading title="Scale">{scale.length} steps · base {config.base}px</CanvasHeading>
        <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
          {scale.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => copyToClipboard(t.name, 'Token')}
              className="grid w-full grid-cols-[6rem_7.5rem_minmax(0,1fr)] items-center gap-4 px-5 py-2.5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:grid-cols-[7rem_3.5rem_8.5rem_minmax(0,1fr)]"
            >
              <span className="font-mono text-xs font-medium">{t.name}</span>
              <span className="hidden font-mono text-xs text-muted-foreground tabular sm:block">×{t.multiplier}</span>
              <span className="font-mono text-xs whitespace-nowrap tabular">
                {t.value}px <span className="text-muted-foreground">· {t.value / 16}rem</span>
              </span>
              <span className="flex h-4 items-center">
                <span
                  className="h-full rounded-[2px]"
                  style={{ width: `${(t.value / max) * 100}%`, minWidth: t.value ? 2 : 0, background: accent.solid, opacity: 0.85 }}
                />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <CanvasHeading title="In a component">Padding and gaps drawn from the scale</CanvasHeading>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Inset */}
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <div className="relative inline-block rounded-xl" style={{ padding: s(6), background: `color-mix(in oklab, ${accent.solid} 14%, transparent)` }}>
              <Callout label={`${spacingTokenName(6)} · ${s(6)}px`} />
              <div className="rounded-lg border bg-card" style={{ padding: s(4) }}>
                <div className="h-3 w-28 rounded-full bg-foreground/80" />
                <div className="h-2.5 w-40 rounded-full bg-muted-foreground/30" style={{ marginTop: s(2) }} />
                <div className="h-2.5 w-32 rounded-full bg-muted-foreground/30" style={{ marginTop: s(1.5) }} />
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Inset — space around content inside a container.</p>
          </div>

          {/* Stack and inline */}
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <div className="flex flex-col" style={{ gap: s(3) }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center" style={{ gap: s(2) }}>
                  <span className="size-8 shrink-0 rounded-full bg-muted" />
                  <div className="flex-1">
                    <div className="h-2.5 w-24 rounded-full bg-foreground/70" />
                    <div className="mt-1.5 h-2 w-36 rounded-full bg-muted-foreground/30" />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Stack <span className="font-mono">space-sm</span> ({s(3)}px) between rows, inline{' '}
              <span className="font-mono">space-xs</span> ({s(2)}px) between avatar and text.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Callout({ label }: { label: string }) {
  return (
    <span className="absolute -top-2.5 left-3 rounded-full border bg-card px-1.5 font-mono text-[0.625rem] text-muted-foreground tabular">
      {label}
    </span>
  );
}

export function SpacingInspector({
  config,
  onChange,
}: {
  config: SpacingConfig;
  onChange: (updates: Partial<SpacingConfig>) => void;
}) {
  return (
    <div className="flex flex-col">
      <Section title="Base unit">
        <SliderField
          label="Unit"
          value={config.base}
          display={`${config.base}px`}
          min={2}
          max={12}
          step={1}
          defaultValue={DEFAULTS.base}
          onChange={(base) => onChange({ base })}
        />
        <p className="text-xs leading-snug text-muted-foreground">
          Every token is a multiple of this unit. 4px suits most product UI; 8px gives a looser rhythm.
        </p>
      </Section>
      <Section title="Progression">
        <SegmentedField
          label="Steps"
          value={config.progression}
          options={[
            { value: 'linear', label: 'Linear' },
            { value: 'geometric', label: 'Geometric' },
          ]}
          onChange={(progression) => onChange({ progression })}
        />
        <p className="text-xs leading-snug text-muted-foreground">
          {config.progression === 'linear'
            ? 'Dense small steps for tight UI, like Tailwind: 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4 …'
            : 'Fewer, wider steps for layouts with more air: 0.5, 1, 2, 3, 4, 6, 8, 12 …'}
        </p>
      </Section>
    </div>
  );
}
