import { useEffect, useMemo, useRef, useState } from 'react';
import chroma from 'chroma-js';
import { ArrowRight, Info, Lock, LockOpen, Plus, TriangleAlert, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { isOverridableStep, normalizeHex, stepOrderIssues, type PaletteRole } from '../../lib/color-utils';
import { cn } from '../ui/utils';
import {
  STEP_USAGE,
  pinStepOverride,
  tidyStepOverrides,
  type GeneratedPalette,
} from '../../lib/export-utils';
import { Section, SelectField, SliderField } from '../foundations/inspector-controls';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../ui/select';
import { COLOR_ROLES, ROLE_LABELS, type ColorRole } from '../../lib/tokens';
import type { PaletteConfig, StepMap, StepOverrides } from './types';

const lightnessPercent = (color: string) => Math.round(chroma(color).oklch()[0] * 100);

/** Who fills a role in an extra product, its own pick or one taken from the first product. */
export interface ProductRoleHolder {
  role: ColorRole;
  palette: RolePalette;
  inherited: boolean;
  /** The first product's palette for this role, what "inherit" falls back to. */
  fallback?: RolePalette;
}

export interface RolePalette {
  id: string;
  name: string;
  baseColor: string;
  gray: boolean;
}

const INHERIT = '__inherit';

const ROLE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  ...COLOR_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
  { value: 'none', label: 'None' },
];

export function PaletteInspector({
  palette,
  tokens,
  onChange,
  onSetRole,
  product,
  focusStep,
}: {
  palette: GeneratedPalette;
  /** A custom step to bring into view and focus, as asked from the canvas; a new nonce asks again. */
  focusStep?: { step: number; nonce: number };
  /** Primitive name and resolved base role of this palette in the export. */
  tokens?: { primitive: string; role?: ColorRole };
  onChange: (updates: Partial<PaletteConfig>) => void;
  /** Sets the token role, swapping with the palette that holds it. */
  onSetRole: (role: ColorRole | 'none' | undefined) => void;
  /** Set when an extra product is active: roles are picked for it, from the ones the first product has. */
  product?: {
    name: string;
    from: string;
    /** Every role in the product and the palette filling it. */
    holders: ProductRoleHolder[];
    /** Palettes that can fill a role: grays for Neutral, accents for the rest. */
    palettes: RolePalette[];
    /** Gives a role to a palette in this product; null inherits it from the first product again. */
    onAssign: (role: ColorRole, paletteId: string | null) => void;
  };
}) {
  const wantedRole = palette.tokenRole && palette.tokenRole !== 'none' ? palette.tokenRole : undefined;
  const roleTaken = wantedRole && tokens?.role !== wantedRole;
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
              <TabsTrigger value="accent" className="rounded-md px-3 text-xs">
                Accent
              </TabsTrigger>
              <TabsTrigger value="gray" className="rounded-md px-3 text-xs">
                Gray
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p className="-mt-1 text-xs leading-snug text-muted-foreground">
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
                  <LockOpen className="mt-0.5 size-3.5 text-muted-foreground" />
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

      <CustomSteps palette={palette} onChange={onChange} focusStep={focusStep} />

      <Section title="Tokens">
        {!product && (
          <SelectField
            label="Token role"
            value={palette.tokenRole ?? 'auto'}
            options={ROLE_OPTIONS}
            onChange={(v) => onSetRole(v === 'auto' ? undefined : (v as ColorRole | 'none'))}
          />
        )}
        {product ? (
          // The role map covers every palette, so this palette's own token line would repeat a row
          <ProductRoles product={product} />
        ) : (
          <>
            {tokens && (
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[0.6875rem] text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5">{tokens.primitive}-*</span>
                <span aria-hidden>→</span>
                {tokens.role ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">{tokens.role}-*</span>
                ) : (
                  <span className="font-sans">no role, exported as primitives only</span>
                )}
              </div>
            )}
            <p className="text-xs leading-snug text-muted-foreground">
              {roleTaken
                ? `${ROLE_LABELS[wantedRole]} is already used by another palette, so this one has no role.`
                : 'Picking a role another palette holds swaps the two. Brand · Primary drives bg-brand and focus-ring; Brand · Secondary drives bg-brand-secondary.'}
            </p>
          </>
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
            placeholder="e.g. Brand"
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

const ORDER_CONSEQUENCE = (step: number) =>
  step === 3 || step === 4
    ? 'hover and active states will look backwards'
    : step === 6 || step === 7
      ? 'borders will look backwards'
      : "the scale won't step in order toward the solid color";

/**
 * Hand-set colors for single steps of the mode being edited, for colors a team already ships.
 * Every other step stays generated, and the pins survive base color and adjustment changes.
 */
function CustomSteps({
  palette,
  onChange,
  focusStep,
}: {
  palette: GeneratedPalette;
  onChange: (updates: Partial<PaletteConfig>) => void;
  focusStep?: { step: number; nonce: number };
}) {
  const mode = palette.isDark ? 'dark' : 'light';
  const otherMode = palette.isDark ? 'light' : 'dark';
  const o = palette.stepOverrides;
  const own = o?.[mode] ?? {};
  const other = o?.[otherMode] ?? {};
  const unsync = o?.unsync ?? [];
  const ownSteps = Object.keys(own)
    .map(Number)
    .filter((s) => isOverridableStep(s) && own[s]);
  const syncedHere = palette.scale.synced ?? [];
  const rows = [...new Set([...ownSteps, ...syncedHere])].sort((a, b) => a - b);
  const generated = palette.scale.overridden ?? {};
  const issues = useMemo(() => stepOrderIssues(palette.scale, palette.isDark), [palette.scale, palette.isDark]);
  const free = Array.from({ length: 12 }, (_, i) => i + 1).filter((s) => isOverridableStep(s) && !rows.includes(s));

  const update = (next: StepOverrides) => onChange({ stepOverrides: tidyStepOverrides(next) });
  const without = (map: StepMap, step: number) => {
    const next = { ...map };
    delete next[step];
    return next;
  };
  const setOwn = (step: number, hex: string) => update({ ...o, [mode]: { ...own, [step]: hex } });
  /** Steps that stay generated here even though the other mode set them by hand. */
  const keepGenerated = (steps: number[]) => [...unsync, ...steps.filter((s) => other[s])];
  /** Back to generated in this mode, without picking up the other mode's color instead. */
  const removeRow = (step: number) => update({ ...o, [mode]: without(own, step), unsync: keepGenerated([step]) });
  const resetAll = () => update({ ...o, [mode]: {}, unsync: keepGenerated(rows) });
  /**
   * On: the other mode follows this step, replacing a color set there by hand.
   * Off: the custom color applies to this mode only, and the other mode stays generated.
   */
  const setSync = (step: number, on: boolean) =>
    on
      ? update({ ...o, [otherMode]: without(other, step), unsync: unsync.filter((s) => s !== step) })
      : update({ ...o, unsync: [...unsync, step] });

  return (
    <Section
      title="Custom steps"
      info="Replace single generated steps with your own colors, such as legacy colors your product already ships. Other steps stay generated, and these stay set when the base color or adjustments change. Step 9 comes from the base color."
      action={
        rows.length > 0 && (
          <Button variant="ghost" size="sm" className="-mr-2 h-6 px-2 text-xs text-muted-foreground" onClick={resetAll}>
            Reset all
          </Button>
        )
      }
    >
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((step) => {
            const followsOther = !own[step];
            return (
              <StepOverrideRow
                key={`${mode}-${step}`}
                step={step}
                value={followsOther ? palette.scale.colors[step - 1] : own[step]!}
                generated={generated[step] ?? palette.scale.colors[step - 1]}
                syncedFrom={followsOther ? { mode: otherMode, color: other[step]! } : undefined}
                focusNonce={focusStep?.step === step ? focusStep.nonce : undefined}
                onChange={(hex) => setOwn(step, hex)}
                onRemove={() => removeRow(step)}
                sync={{
                  label: followsOther ? `Follow ${otherMode}` : `Sync ${otherMode}`,
                  checked: followsOther || (!other[step] && !unsync.includes(step)),
                  onChange: (on) => setSync(step, on),
                }}
              />
            );
          })}
        </ul>
      )}

      <Select
        value=""
        onValueChange={(v) => {
          const step = Number(v);
          update(pinStepOverride(o, mode, step, palette.scale.colors[step - 1].toLowerCase()));
        }}
      >
        <SelectTrigger size="sm" className="w-full" aria-label="Set a step by hand">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Plus className="size-3.5" />
            Set a step by hand
          </span>
        </SelectTrigger>
        <SelectContent>
          {free.map((step) => (
            <SelectItem key={step} value={String(step)}>
              <Swatch color={palette.scale.colors[step - 1]} />
              <span className="font-mono tabular">{step}</span>
              <span className="text-muted-foreground">{STEP_USAGE[step - 1]}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {issues.map(({ step, next }) => (
        <p key={step} className="flex gap-1.5 text-xs leading-snug text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-px size-3.5 shrink-0" />
          <span>
            Step {step} is {palette.isDark ? 'lighter' : 'darker'} than step {next}, so {ORDER_CONSEQUENCE(step)}.
          </span>
        </p>
      ))}

      <p className="text-xs leading-snug text-muted-foreground">
        Editing {mode} mode. Pinned steps sync to {otherMode}.
      </p>
    </Section>
  );
}

function StepOverrideRow({
  step,
  value,
  generated,
  syncedFrom,
  sync,
  focusNonce,
  onChange,
  onRemove,
}: {
  step: number;
  value: string;
  /** What the generator would put here. */
  generated: string;
  /** Set when this mode has no color of its own and follows the other mode's custom color. */
  syncedFrom?: { mode: string; color: string };
  /** Whether this step and the other mode's share one custom color. */
  sync: { label: string; checked: boolean; onChange: (on: boolean) => void };
  /** Changes when the canvas asks for this row, which then scrolls into view and selects its hex. */
  focusNonce?: number;
  onChange: (hex: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const valid = normalizeHex(draft) !== null;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusNonce === undefined) return;
    // Wait a frame so a just-opened inspector sheet has mounted and laid out the row
    const id = requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      input.focus({ preventScroll: true });
      input.select();
    });
    return () => cancelAnimationFrame(id);
  }, [focusNonce]);

  useEffect(() => {
    setDraft((d) => (normalizeHex(d) === value ? d : value));
  }, [value]);


  return (
    <li className="space-y-2.5 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">
          <span className="font-medium">Step {step}</span>
          <span className="text-muted-foreground"> · {STEP_USAGE[step - 1]}</span>
        </span>
        <span className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            className="relative size-6 text-muted-foreground after:absolute after:-inset-1"
            aria-label={`Use generated step ${step}`}
            onClick={onRemove}
          >
            <X className="size-3.5" />
          </Button>
        </span>
      </div>
      <div className="flex gap-2">
        <label
          className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)] focus-within:ring-[3px] focus-within:ring-ring/50"
          style={{ backgroundColor: value }}
        >
          <span className="sr-only">Pick step {step} color</span>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <Input
          ref={inputRef}
          aria-label={`Step ${step} hex`}
          aria-invalid={!valid}
          value={draft}
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value);
            const hex = normalizeHex(e.target.value);
            if (hex) onChange(hex);
          }}
          onBlur={() => setDraft(value)}
          className="h-8 font-mono uppercase"
        />
      </div>
      {!valid ? (
        <p className="text-xs text-destructive">Enter a 3 or 6 digit hex value.</p>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {syncedFrom ? (
            <>
              <span>From {syncedFrom.mode}</span>
              <Swatch color={syncedFrom.color} />
              <span className="font-mono uppercase">{syncedFrom.color}</span>
            </>
          ) : (
            <>
              <span>Generated</span>
              <Swatch color={generated} />
              <span className="font-mono uppercase">{generated}</span>
            </>
          )}
        </div>
      )}
      <label
        htmlFor={`sync-step-${step}`}
        className="flex cursor-pointer items-center justify-between gap-3 border-t pt-2.5 text-xs text-muted-foreground"
      >
        {sync.label}
        <Switch id={`sync-step-${step}`} checked={sync.checked} onCheckedChange={sync.onChange} />
      </label>
    </li>
  );
}

function Swatch({ color, muted }: { color: string; muted?: boolean }) {
  return <span aria-hidden className={cn('swatch-outline size-3 shrink-0 rounded-full', muted && 'opacity-60')} style={{ backgroundColor: color }} />;
}

/**
 * The product's role map, edited in place: each role picks its palette, or inherits the first
 * product's. Rows keep a fixed order so nothing jumps when a role changes hands.
 */
function ProductRoles({ product }: { product: NonNullable<Parameters<typeof PaletteInspector>[0]['product']> }) {
  const own = product.holders.filter((h) => !h.inherited).length;
  const brandInherited = product.holders.some((h) => h.inherited && h.role === 'brand');
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">Roles in {product.name}</span>
        <span className="text-xs text-muted-foreground tabular">
          {own} of {product.holders.length} set
        </span>
      </div>
      <ul className="space-y-1.5">
        {product.holders.map(({ role, palette: p, inherited, fallback }) => {
          const options = product.palettes.filter((o) => o.gray === (role === 'neutral'));
          const inheritFrom = fallback ?? (inherited ? p : undefined);
          return (
            <li key={role} className="flex items-center justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{ROLE_LABELS[role]}</span>
              <Select value={inherited ? INHERIT : p.id} onValueChange={(v) => product.onAssign(role, v === INHERIT ? null : v)}>
                <SelectTrigger
                  size="sm"
                  aria-label={`${ROLE_LABELS[role]} in ${product.name}`}
                  className="w-[11rem] min-w-0 px-2.5"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <Swatch color={p.baseColor} muted={inherited} />
                    {/* Name and tag differ in size, so they share a baseline rather than a center. The tag
                        sits by the chevron, so inherited rows read as one column */}
                    <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                      <span className={cn('truncate', inherited ? 'text-muted-foreground' : 'font-medium')}>{p.name || 'Untitled'}</span>
                      {inherited && <span className="ml-auto shrink-0 text-xs text-muted-foreground/70">{product.from}</span>}
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent align="end">
                  {inheritFrom && (
                    <SelectItem value={INHERIT}>
                      <Swatch color={inheritFrom.baseColor} muted />
                      <span className="text-muted-foreground">Inherit · {inheritFrom.name || 'Untitled'}</span>
                    </SelectItem>
                  )}
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      <Swatch color={o.baseColor} />
                      {o.name || 'Untitled'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>
      <p className={cn('text-xs leading-snug', brandInherited ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
        {brandInherited
          ? `${product.name} still uses ${product.from}'s brand color. Pick a palette for Brand · Primary to give it its own.`
          : `Roles left on inherit use ${product.from}'s palettes.`}
      </p>
    </div>
  );
}
