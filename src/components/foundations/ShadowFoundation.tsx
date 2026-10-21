import { useEffect, useMemo, useState } from 'react';
import { Pipette } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { normalizeHex } from '../../lib/color-utils';
import { copyToClipboard } from '../../lib/clipboard';
import { DEFAULT_FOUNDATIONS, SHADOW_STYLES, type ShadowConfig, generateShadowScale } from '../../lib/foundations';
import { CanvasHeading, Section, SelectField, SliderField } from './inspector-controls';

const DEFAULTS = DEFAULT_FOUNDATIONS.shadow;

export function ShadowCanvas({ config, isDark, radius }: { config: ShadowConfig; isDark: boolean; radius: number }) {
  const scale = useMemo(() => generateShadowScale(config, isDark), [config, isDark]);

  return (
    <div className="space-y-8">
      <div>
        <CanvasHeading title="Elevation">
          {SHADOW_STYLES.find((s) => s.value === config.style)?.label} · tuned for {isDark ? 'dark' : 'light'} surfaces
        </CanvasHeading>
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 rounded-2xl border bg-background p-6 sm:grid-cols-3 sm:p-10">
          {scale.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => copyToClipboard(s.css, `shadow-${s.name}`)}
              className="group flex flex-col gap-3 text-left focus-visible:outline-none"
            >
              <div
                className="flex aspect-[4/3] items-center justify-center bg-card transition-transform group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-ring"
                style={{ boxShadow: s.css, borderRadius: radius }}
              >
                <span className="font-mono text-2xl font-medium text-muted-foreground/60 tabular">{s.elevation}</span>
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs font-medium">shadow-{s.name}</span>
                  <span className="text-[0.6875rem] text-muted-foreground tabular">
                    {s.layers.length} {s.layers.length === 1 ? 'layer' : 'layers'}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground">{s.usage}</div>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Click a card to copy its CSS. Switch the theme to get the dark set, which uses stronger opacity so it still
          reads on dark surfaces.
        </p>
      </div>

      <div>
        <CanvasHeading title="Layers" />
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
          <table className="w-full min-w-[34rem] text-left text-xs">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-medium">Token</th>
                <th className="px-3 py-2.5 font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {scale.map((s) => (
                <tr key={s.name}>
                  <td className="px-5 py-2.5 align-top font-mono font-medium">shadow-{s.name}</td>
                  <td className="px-3 py-2.5 font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
                    {s.layers.map((l, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="swatch-outline size-3 shrink-0 rounded-[3px] checkerboard">
                          <span className="block size-full rounded-[3px]" style={{ background: l.color }} />
                        </span>
                        {l.x}px {l.y}px {l.blur}px {l.spread}px
                      </div>
                    ))}
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

export function ShadowInspector({
  config,
  accent,
  onChange,
}: {
  config: ShadowConfig;
  /** Primary step 9, offered as a one-click tint. */
  accent: string;
  onChange: (updates: Partial<ShadowConfig>) => void;
}) {
  const [hexDraft, setHexDraft] = useState(config.tint);
  useEffect(() => setHexDraft(config.tint), [config.tint]);

  return (
    <div className="flex flex-col">
      <Section title="Style">
        <SelectField
          label="Scale"
          value={config.style}
          options={SHADOW_STYLES.map((s) => ({ value: s.value, label: s.label }))}
          onChange={(style) => onChange({ style })}
        />
        <p className="text-xs leading-snug text-muted-foreground">{SHADOW_STYLES.find((s) => s.value === config.style)?.hint}.</p>
        <SliderField
          label="Intensity"
          value={config.intensity}
          display={`${config.intensity.toFixed(2)}×`}
          min={0.25}
          max={2.5}
          step={0.05}
          defaultValue={DEFAULTS.intensity}
          onChange={(intensity) => onChange({ intensity })}
        />
        <SliderField
          label="Light angle"
          value={config.lightAngle}
          display={`${config.lightAngle > 0 ? '+' : ''}${config.lightAngle}°`}
          min={-45}
          max={45}
          step={1}
          defaultValue={DEFAULTS.lightAngle}
          onChange={(lightAngle) => onChange({ lightAngle })}
        />
      </Section>

      <Section title="Tint">
        <div className="flex gap-2">
          <label
            className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)] focus-within:ring-[3px] focus-within:ring-ring/50"
            style={{ backgroundColor: config.tint }}
          >
            <span className="sr-only">Pick tint color</span>
            <input
              type="color"
              value={config.tint}
              onChange={(e) => onChange({ tint: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <Input
            aria-label="Tint hex"
            value={hexDraft}
            spellCheck={false}
            onChange={(e) => {
              setHexDraft(e.target.value);
              const hex = normalizeHex(e.target.value);
              if (hex) onChange({ tint: hex });
            }}
            onBlur={() => setHexDraft(config.tint)}
            className="font-mono uppercase"
          />
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label="Use primary color"
            title="Use primary color"
            onClick={() => onChange({ tint: accent })}
          >
            <Pipette />
          </Button>
        </div>
        <SliderField
          label="Strength"
          value={config.tintStrength}
          display={`${Math.round(config.tintStrength * 100)}%`}
          min={0}
          max={1}
          step={0.05}
          defaultValue={DEFAULTS.tintStrength}
          onChange={(tintStrength) => onChange({ tintStrength })}
        />
        <p className="text-xs leading-snug text-muted-foreground">
          A little brand color in shadows makes them feel part of the surface instead of grey smudges.
        </p>
      </Section>
    </div>
  );
}
