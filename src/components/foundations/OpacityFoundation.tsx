import { copyToClipboard } from '../../lib/clipboard';
import { cn } from '../ui/utils';
import {
  type Accent,
  type Foundations,
  OPACITY_PRESETS,
  type OpacityConfig,
  generateOpacityScale,
  opacityPercent,
} from '../../lib/foundations';
import { CanvasHeading, NumberInput, Section } from './inspector-controls';

/** A swatch of `color` at `percent`, over a checkerboard so the transparency shows. */
function Swatch({ color, percent, className }: { color: string; percent: number; className?: string }) {
  return (
    <span className={cn('checkerboard block overflow-hidden border', className)}>
      <span className="block size-full" style={{ background: color, opacity: percent / 100 }} />
    </span>
  );
}

export function OpacityCanvas({
  foundations: f,
  accent,
  scrim,
}: {
  foundations: Foundations;
  accent: Accent;
  /** bg-scrim in the mode shown: the solid neutral it's built on, and its result under opacity-scrim. */
  scrim: { base: string; color: string };
}) {
  const scale = generateOpacityScale(f.opacity);
  const disabled = opacityPercent(f, 'opacity-disabled') ?? 0;
  const scrimPercent = opacityPercent(f, 'opacity-scrim') ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <CanvasHeading title="Scale">{scale.length} steps</CanvasHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {scale.map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => copyToClipboard(`opacity-scale-${s.step}`, 'Token')}
              className="rounded-2xl border bg-card p-3 text-left shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Swatch color={accent.solid} percent={s.value} className="aspect-[4/3] w-full rounded-lg" />
              <div className="mt-2.5 flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs font-medium">scale-{s.step}</span>
                <span className="font-mono text-[0.6875rem] text-muted-foreground tabular">{s.value}%</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <CanvasHeading title="In use" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-md px-4 py-2 text-sm font-medium" style={{ background: accent.solid, color: accent.contrast }}>
                Save
              </span>
              <span className="cursor-not-allowed rounded-md px-4 py-2 text-sm font-medium" style={{ background: accent.solid, color: accent.contrast, opacity: disabled / 100 }}>
                Save
              </span>
              <span className="cursor-not-allowed rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground" style={{ opacity: disabled / 100 }}>
                Read only
              </span>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              <span className="font-mono">opacity-disabled</span> · {disabled}% on the whole layer
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <div className="relative overflow-hidden rounded-lg border bg-background p-3">
              {/* The page under the backdrop */}
              <div className="space-y-1.5" aria-hidden>
                <div className="h-2 w-2/3 rounded-full bg-foreground/60" />
                <div className="h-2 w-full rounded-full bg-foreground/25" />
                <div className="h-2 w-5/6 rounded-full bg-foreground/25" />
                <div className="mt-2 h-6 w-16 rounded-md" style={{ background: accent.solid }} />
              </div>
              <div className="absolute inset-0 grid place-items-center" style={{ background: scrim.color }}>
                <div className="w-3/5 rounded-lg border bg-card p-3 shadow-lg">
                  <div className="h-2 w-1/2 rounded-full bg-foreground/70" />
                  <div className="mt-2 h-2 w-full rounded-full bg-foreground/25" />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-3 shrink-0 rounded-[3px] border" style={{ background: scrim.base }} />
              <span>
                <span className="font-mono">bg-scrim</span> · solid neutral at {scrimPercent}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The scale only: roles and purposes are re-pointed in the Tokens tab, like every other foundation's. */
export function OpacityInspector({ config, onChange }: { config: OpacityConfig; onChange: (updates: Partial<OpacityConfig>) => void }) {
  const preset = OPACITY_PRESETS.find((p) => p.steps.every((v, i) => v === config.steps[i]));
  const setStep = (i: number, value: number) => onChange({ steps: config.steps.map((v, j) => (j === i ? value : v)) });

  return (
    <div className="flex flex-col">
      <Section title="Presets">
        <div className="grid grid-cols-3 gap-1.5">
          {OPACITY_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              aria-pressed={preset === p}
              onClick={() => onChange({ steps: [...p.steps] })}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border px-1 py-2.5 text-[0.6875rem] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                preset === p && 'border-foreground/40 bg-accent',
              )}
            >
              <span className="flex h-4 w-16 overflow-hidden rounded-sm">
                {p.steps.map((v) => (
                  <span key={v} className="flex-1 bg-foreground" style={{ opacity: v / 100 }} />
                ))}
              </span>
              {p.label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Scale" info="Percent per step. Each stays between its neighbours, so the steps keep their order and names.">
        <div className="flex flex-col gap-2">
          {config.steps.map((v, i) => (
            <label key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground">scale-{i + 1}</span>
              <span className="flex items-center gap-1">
                <NumberInput
                  aria-label={`Step ${i + 1} percent`}
                  value={v}
                  min={config.steps[i - 1] ?? 0}
                  max={config.steps[i + 1] ?? 100}
                  onChange={(n) => setStep(i, n)}
                  className="h-8 w-14 px-2 text-right font-mono text-xs tabular"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs leading-snug text-muted-foreground">
          Steps are named by position, not value, so editing a percent keeps every token name and every alias.
        </p>
      </Section>
    </div>
  );
}
