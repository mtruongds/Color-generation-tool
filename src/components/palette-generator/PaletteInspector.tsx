import { useEffect, useId, useState } from 'react';
import chroma from 'chroma-js';
import { ArrowRight, Info, Lock, RotateCcw, Unlock } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { normalizeHex, type PaletteRole } from '../../lib/color-utils';
import type { GeneratedPalette } from '../../lib/export-utils';
import type { PaletteConfig } from './types';

const lightnessPercent = (color: string) => Math.round(chroma(color).oklch()[0] * 100);

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b px-5 py-5 last:border-b-0">
      <div className="flex h-5 items-center justify-between">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function SliderField({
  label,
  value,
  display,
  min,
  max,
  step,
  defaultValue,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const changed = value !== defaultValue;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm font-normal">
          {label}
        </Label>
        <div className="flex items-center gap-1">
          {changed && (
            <Button
              variant="ghost"
              size="icon"
              className="relative size-6 text-muted-foreground after:absolute after:-inset-2"
              aria-label={`Reset ${label}`}
              onClick={() => onChange(defaultValue)}
            >
              <RotateCcw className="size-3" />
            </Button>
          )}
          <span className="min-w-[3rem] rounded-md bg-muted px-1.5 py-0.5 text-right font-mono text-xs tabular">
            {display}
          </span>
        </div>
      </div>
      <Slider id={id} min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

export function PaletteInspector({
  palette,
  onChange,
}: {
  palette: GeneratedPalette;
  onChange: (updates: Partial<PaletteConfig>) => void;
}) {
  const [hexDraft, setHexDraft] = useState(palette.baseColor);
  const hexValid = normalizeHex(hexDraft) !== null;

  // Keep the draft in sync when the color changes elsewhere (picker, preset, palette switch).
  // A partial draft like "#3e6" already maps to the current color, so leave it alone mid-typing.
  useEffect(() => {
    setHexDraft((draft) => (normalizeHex(draft) === palette.baseColor ? draft : palette.baseColor));
  }, [palette.baseColor, palette.id]);

  const role: PaletteRole = palette.role ?? 'accent';
  // The generated step 9 differs from the base only when Radix's background-proximity safeguard kicks in
  const step9Color = palette.scale.colors[8];
  const step9Adjusted = role === 'accent' && !palette.lockStep9 && step9Color.toLowerCase() !== palette.baseColor.toLowerCase();
  const [mixA, mixB, mixRatio] = palette.scale.mixedFrom;
  const mixDescription =
    mixRatio > 0
      ? `Fitted from Radix ${mixA} mixed with ${Math.round(mixRatio * 100)}% ${mixB}, then reshaped in OKLCH`
      : `Fitted from Radix ${mixA}, then reshaped in OKLCH`;

  return (
    <div className="flex flex-col">
      <Section title="Base color">
        <div className="flex gap-2">
          <label
            className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)] focus-within:ring-[3px] focus-within:ring-ring/50"
            style={{ backgroundColor: palette.baseColor }}
          >
            <span className="sr-only">Pick base color</span>
            <input
              type="color"
              value={palette.baseColor}
              onChange={(e) => onChange({ baseColor: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <div className="relative flex-1">
            <Input
              aria-label="Base color hex"
              aria-invalid={!hexValid}
              value={hexDraft}
              spellCheck={false}
              onChange={(e) => {
                setHexDraft(e.target.value);
                const hex = normalizeHex(e.target.value);
                if (hex) onChange({ baseColor: hex });
              }}
              onBlur={() => setHexDraft(palette.baseColor)}
              className="font-mono uppercase"
            />
          </div>
        </div>
        {!hexValid && <p className="text-xs text-destructive">Enter a 3 or 6 digit hex value.</p>}

        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm font-normal">Role</Label>
          <Tabs value={role} onValueChange={(v) => onChange({ role: v as PaletteRole })} className="gap-0">
            <TabsList className="h-8 rounded-lg" aria-label="Palette role">
              <TabsTrigger value="accent" disabled={palette.locked} className="rounded-md px-3 text-xs">
                Accent
              </TabsTrigger>
              <TabsTrigger value="gray" disabled={palette.locked} className="rounded-md px-3 text-xs">
                Gray
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p className="-mt-1 text-xs leading-snug text-muted-foreground">
          {palette.locked && 'Default palette — its role is fixed and it can’t be deleted. '}
          {role === 'gray'
            ? 'Fitted to the Radix gray scales only. Step 9 follows the scale, not the exact base color. Also tints pure black or white accents.'
            : 'Fitted to all Radix scales, with step 9 anchored to the base color.'}
        </p>

        {role === 'accent' && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {palette.lockStep9 ? (
                  <Lock className="mt-0.5 size-3.5 text-muted-foreground" />
                ) : (
                  <Unlock className="mt-0.5 size-3.5 text-muted-foreground" />
                )}
                <div>
                  <Label htmlFor="lock-step9" className="text-sm font-medium">
                    Lock step 9
                  </Label>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                    Use the exact base color, even if it sits too close to the background.
                  </p>
                </div>
              </div>
              <Switch
                id="lock-step9"
                checked={palette.lockStep9}
                onCheckedChange={(checked) => onChange({ lockStep9: checked })}
              />
            </div>

            {step9Adjusted && (
              <div className="mt-3 flex items-center gap-2 border-t pt-3 text-xs">
                <span className="size-4 rounded shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]" style={{ backgroundColor: palette.baseColor }} />
                <ArrowRight className="size-3 text-muted-foreground" />
                <span className="size-4 rounded shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]" style={{ backgroundColor: step9Color }} />
                <span className="text-muted-foreground">
                  Too close to the background, step 9 uses{' '}
                  <span className="font-mono text-foreground tabular">
                    L {lightnessPercent(palette.baseColor)}% → {lightnessPercent(step9Color)}%
                  </span>
                </span>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Details">
        <div className="space-y-1.5">
          <Label htmlFor="palette-name" className="text-sm font-normal">
            Name
          </Label>
          <Input
            id="palette-name"
            value={palette.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Primary"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="palette-description" className="text-sm font-normal">
            Description <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="palette-description"
            className="min-h-[4.5rem] resize-none text-sm"
            placeholder="Used for primary actions and links."
            value={palette.description || ''}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
      </Section>

      <Section title="Adjustments">
        <SliderField
          label="Hue shift"
          value={palette.hueShift}
          display={`${palette.hueShift > 0 ? '+' : ''}${palette.hueShift}°`}
          min={-180}
          max={180}
          step={1}
          defaultValue={0}
          onChange={(hueShift) => onChange({ hueShift })}
        />
        <SliderField
          label="Saturation"
          value={palette.saturationScale}
          display={`${palette.saturationScale.toFixed(2)}×`}
          min={0}
          max={2}
          step={0.05}
          defaultValue={1}
          onChange={(saturationScale) => onChange({ saturationScale })}
        />
      </Section>

      <div className="flex gap-2 px-5 py-4 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>{mixDescription}.</p>
      </div>
    </div>
  );
}
